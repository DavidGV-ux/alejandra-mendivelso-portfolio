import {
  BackSide,
  Color,
  FogExp2,
  Mesh,
  Scene,
  ShaderMaterial,
  SphereGeometry,
} from 'three';
import { theme } from '@/config/theme';
import type { ThemeMode } from '@/types/theme';

interface EnvironmentHandle {
  setMode: (mode: Exclude<ThemeMode, 'auto'>) => void;
  dispose: () => void;
}

const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform float offset;
  varying vec3 vWorldPosition;
  void main() {
    float h = normalize(vWorldPosition + offset).y;
    float t = smoothstep(-0.35, 0.65, h);
    gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
  }
`;

export function createEnvironment(
  scene: Scene,
  mode: Exclude<ThemeMode, 'auto'>,
): EnvironmentHandle {
  const bottom = new Color();
  const top = new Color();

  const material = new ShaderMaterial({
    uniforms: {
      topColor: { value: top },
      bottomColor: { value: bottom },
      offset: { value: 12 },
    },
    vertexShader,
    fragmentShader,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });

  const backdrop = new Mesh(new SphereGeometry(90, 32, 16), material);
  backdrop.frustumCulled = false;
  scene.add(backdrop);

  const fog = new FogExp2(theme.colors.fog, theme.fogDensity);
  scene.fog = fog;

  function setMode(next: Exclude<ThemeMode, 'auto'>): void {
    const palette = next === 'dark'
      ? { top: '#1f1b18', bottom: '#0f0d0b', fog: '#141210' }
      : { top: '#fbf8f3', bottom: '#e7dfd4', fog: theme.colors.fog };
    top.set(palette.top);
    bottom.set(palette.bottom);
    const uniforms = material.uniforms as Record<string, { value: unknown }>;
    uniforms.topColor!.value = top;
    uniforms.bottomColor!.value = bottom;
    fog.color.set(palette.fog);
  }
  setMode(mode);

  return {
    setMode,
    dispose: () => {
      backdrop.geometry.dispose();
      material.dispose();
      scene.remove(backdrop);
    },
  };
}
