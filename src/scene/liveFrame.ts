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
  uniform vec3 uBlueDeep;
  uniform vec3 uBlueSoft;
  uniform vec2 uMatHalf;
  uniform float uMatWidth;
  varying vec2 vUv;

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    vec3 color;
    float pulse;
    if (uMode > 0.5) {
      // Modo día: paspartú blanco puro, sin líneas ni ondas.
      color = uWhite;
      pulse = 1.0;
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
  uniform vec3 uBlueGlow;
  uniform vec3 uBlueSoft;
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
      color = mix(uBlueGlow, uBlueSoft, wave * 0.5);
      strength = 0.0;
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
  blueDeep: '#5f92c4',
  blueSoft: '#c3d9ec',
  blueGlow: '#86b3da',
};

const HALO = 0.55;

/**
 * Marco "vivo" para los proyectos con video. De noche el paspartú fluye con
 * la paleta del video; de día es blanco con líneas y curvas azules que
 * recorren el marco y un halo azul que brilla alrededor. La animación avanza
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
  const blueDeep = new Color(DAY_PALETTE.blueDeep);
  const blueSoft = new Color(DAY_PALETTE.blueSoft);
  const blueGlow = new Color(DAY_PALETTE.blueGlow);

  const matMaterial = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uMode: { value: 0 },
      uGreen: { value: green },
      uOrange: { value: orange },
      uCream: { value: cream },
      uWhite: { value: white },
      uBlueDeep: { value: blueDeep },
      uBlueSoft: { value: blueSoft },
      uMatHalf: { value: [(frameW + 2 * mat) / 2, (frameH + 2 * mat) / 2] },
      uMatWidth: { value: mat },
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
      uBlueGlow: { value: blueGlow },
      uBlueSoft: { value: blueSoft },
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
