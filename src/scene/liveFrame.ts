import { Color, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';

export interface LiveFrameFx {
  /** Material animado del paspartú (sustituye al material estático del marco). */
  matMaterial: ShaderMaterial;
  /** Halo suave detrás del marco. */
  group: Group;
  update: (time: number, opacity: number) => void;
  dispose: () => void;
}

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MAT_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uGreen;
  uniform vec3 uOrange;
  uniform vec3 uCream;
  varying vec2 vUv;

  void main() {
    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
    float waveA = 0.5 + 0.5 * sin(angle + uTime * 0.6);
    float waveB = 0.5 + 0.5 * sin(angle * 2.0 - uTime * 0.4 + 2.1);
    vec3 color = mix(uGreen, uOrange, waveA * 0.72);
    color = mix(color, uCream, waveB * 0.26);
    float pulse = 0.88 + 0.12 * sin(uTime * 1.1);
    gl_FragColor = vec4(color, uOpacity * pulse);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uGreen;
  uniform vec3 uOrange;
  uniform vec2 uFrameHalf;
  uniform vec2 uPlaneHalf;
  uniform float uFalloff;
  varying vec2 vUv;

  void main() {
    vec2 d = (abs(vUv - 0.5) - uFrameHalf) * 2.0 * uPlaneHalf;
    float outside = length(max(d, 0.0));
    float halo = smoothstep(uFalloff, 0.0, outside);
    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
    float wave = 0.5 + 0.5 * sin(angle + uTime * 0.6);
    vec3 color = mix(uGreen, uOrange, wave * 0.6);
    float breathe = 0.5 + 0.5 * sin(uTime * 1.1 + 1.2);
    gl_FragColor = vec4(color, uOpacity * halo * halo * (0.2 + 0.18 * breathe));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const PALETTE = {
  green: '#2f7a5b',
  orange: '#f29b4b',
  cream: '#e4ece0',
};

const HALO = 0.55;

/**
 * Marco "vivo" para los proyectos con video: el paspartú fluye con la paleta
 * del video y un halo suave respira alrededor del marco. La animación avanza
 * con los renders del corredor (el video los despierta a ~30 fps).
 */
export function createLiveFrameFx(frameW: number, frameH: number, border: number, mat: number): LiveFrameFx {
  const outerW = frameW + 2 * mat + 2 * border;
  const outerH = frameH + 2 * mat + 2 * border;
  const planeW = outerW + 2 * HALO;
  const planeH = outerH + 2 * HALO;

  const green = new Color(PALETTE.green);
  const orange = new Color(PALETTE.orange);
  const cream = new Color(PALETTE.cream);

  const matMaterial = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uGreen: { value: green },
      uOrange: { value: orange },
      uCream: { value: cream },
    },
    vertexShader: VERTEX,
    fragmentShader: MAT_FRAGMENT,
    transparent: true,
  });

  const haloMaterial = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uGreen: { value: green },
      uOrange: { value: orange },
      uFrameHalf: { value: [outerW / (2 * planeW), outerH / (2 * planeH)] },
      uPlaneHalf: { value: [planeW / 2, planeH / 2] },
      uFalloff: { value: HALO },
    },
    vertexShader: VERTEX,
    fragmentShader: HALO_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });

  const halo = new Mesh(new PlaneGeometry(planeW, planeH), haloMaterial);
  halo.position.z = -0.012;

  const group = new Group();
  group.add(halo);

  return {
    matMaterial,
    group,
    update(time: number, opacity: number): void {
      matMaterial.uniforms.uTime!.value = time;
      matMaterial.uniforms.uOpacity!.value = opacity;
      haloMaterial.uniforms.uTime!.value = time;
      haloMaterial.uniforms.uOpacity!.value = opacity;
    },
    dispose(): void {
      halo.geometry.dispose();
      matMaterial.dispose();
      haloMaterial.dispose();
      group.clear();
    },
  };
}
