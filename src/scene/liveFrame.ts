import { Color, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import type { ThemeMode } from '@/types/theme';

export interface LiveFrameFx {
  /** Material animado del paspartú (sustituye al material estático del marco). */
  matMaterial: ShaderMaterial;
  /** Halo suave detrás del marco. */
  group: Group;
  update: (time: number, opacity: number) => void;
  setMode: (mode: Exclude<ThemeMode, 'auto'>) => void;
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
  uniform float uMode;
  uniform vec3 uGreen;
  uniform vec3 uOrange;
  uniform vec3 uCream;
  uniform vec3 uWhite;
  uniform vec3 uCloudBlue;
  uniform vec3 uCloudGray;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.55;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(11.3, 7.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 color;
    float pulse;
    if (uMode > 0.5) {
      // Modo día: blanco con nubes suaves azules y grises que derivan lento.
      vec2 p = vec2(vUv.x * 2.6, vUv.y * 1.9);
      float n1 = fbm(p + vec2(uTime * 0.035, -uTime * 0.02));
      float n2 = fbm(p * 1.7 + vec2(-uTime * 0.022, uTime * 0.03) + 4.7);
      color = uWhite;
      color = mix(color, uCloudGray, smoothstep(0.48, 0.74, n1) * 0.9);
      color = mix(color, uCloudBlue, smoothstep(0.52, 0.8, n2) * 0.75);
      pulse = 0.97 + 0.03 * sin(uTime * 0.9);
    } else {
      // Modo noche: la paleta del video fluye alrededor del marco.
      float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
      float waveA = 0.5 + 0.5 * sin(angle + uTime * 0.6);
      float waveB = 0.5 + 0.5 * sin(angle * 2.0 - uTime * 0.4 + 2.1);
      color = mix(uGreen, uOrange, waveA * 0.72);
      color = mix(color, uCream, waveB * 0.26);
      pulse = 0.88 + 0.12 * sin(uTime * 1.1);
    }
    gl_FragColor = vec4(color, uOpacity * pulse);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uMode;
  uniform vec3 uGreen;
  uniform vec3 uOrange;
  uniform vec3 uCloudBlue;
  uniform vec3 uCloudGray;
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
    vec3 color;
    float strength;
    if (uMode > 0.5) {
      color = mix(uCloudBlue, uCloudGray, wave * 0.6);
      strength = 0.18 + 0.14 * (0.5 + 0.5 * sin(uTime * 0.9 + 1.2));
    } else {
      color = mix(uGreen, uOrange, wave * 0.6);
      strength = 0.2 + 0.18 * (0.5 + 0.5 * sin(uTime * 1.1 + 1.2));
    }
    gl_FragColor = vec4(color, uOpacity * halo * halo * strength);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const NIGHT_PALETTE = {
  green: '#2f7a5b',
  orange: '#f29b4b',
  cream: '#e4ece0',
};

const DAY_PALETTE = {
  white: '#ffffff',
  cloudBlue: '#a9c6de',
  cloudGray: '#d7dce1',
};

const HALO = 0.55;

/**
 * Marco "vivo" para los proyectos con video. De noche el paspartú fluye con
 * la paleta del video; de día es blanco con nubes azules y grises que derivan
 * despacio. Un halo suave respira alrededor del marco. La animación avanza
 * con los renders del corredor (el video los despierta a ~30 fps).
 */
export function createLiveFrameFx(frameW: number, frameH: number, border: number, mat: number): LiveFrameFx {
  const outerW = frameW + 2 * mat + 2 * border;
  const outerH = frameH + 2 * mat + 2 * border;
  const planeW = outerW + 2 * HALO;
  const planeH = outerH + 2 * HALO;

  const green = new Color(NIGHT_PALETTE.green);
  const orange = new Color(NIGHT_PALETTE.orange);
  const cream = new Color(NIGHT_PALETTE.cream);
  const white = new Color(DAY_PALETTE.white);
  const cloudBlue = new Color(DAY_PALETTE.cloudBlue);
  const cloudGray = new Color(DAY_PALETTE.cloudGray);

  const matMaterial = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uMode: { value: 0 },
      uGreen: { value: green },
      uOrange: { value: orange },
      uCream: { value: cream },
      uWhite: { value: white },
      uCloudBlue: { value: cloudBlue },
      uCloudGray: { value: cloudGray },
    },
    vertexShader: VERTEX,
    fragmentShader: MAT_FRAGMENT,
    transparent: true,
  });

  const haloMaterial = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uMode: { value: 0 },
      uGreen: { value: green },
      uOrange: { value: orange },
      uCloudBlue: { value: cloudBlue },
      uCloudGray: { value: cloudGray },
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
    setMode(mode: Exclude<ThemeMode, 'auto'>): void {
      const value = mode === 'light' ? 1 : 0;
      matMaterial.uniforms.uMode!.value = value;
      haloMaterial.uniforms.uMode!.value = value;
    },
    dispose(): void {
      halo.geometry.dispose();
      matMaterial.dispose();
      haloMaterial.dispose();
      group.clear();
    },
  };
}
