import {
  ACESFilmicToneMapping,
  Color,
  PCFSoftShadowMap,
  WebGLRenderer,
} from 'three';
import type { QualityPreset } from './quality';
import { getPalette } from '@/config/theme';
import type { ThemeMode } from '@/types/theme';

export interface RendererHandle {
  renderer: WebGLRenderer;
  setPixelRatio: (ratio: number) => void;
  applyTheme: (mode: Exclude<ThemeMode, 'auto'>) => void;
  dispose: () => void;
}

export function createRenderer(
  canvas: HTMLCanvasElement,
  quality: QualityPreset,
  mode: Exclude<ThemeMode, 'auto'>,
): RendererHandle {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: quality.antialias,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
  });

  renderer.setPixelRatio(quality.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  if (quality.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
  }

  function applyTheme(nextMode: Exclude<ThemeMode, 'auto'>): void {
    const palette = getPalette(nextMode);
    renderer.setClearColor(new Color(palette.fog), 1);
  }
  applyTheme(mode);

  return {
    renderer,
    setPixelRatio: (ratio: number) => renderer.setPixelRatio(Math.min(ratio, 2)),
    applyTheme,
    dispose: () => renderer.dispose(),
  };
}
