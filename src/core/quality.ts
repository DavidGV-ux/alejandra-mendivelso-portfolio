import type { Capabilities, QualityTier } from '@/types/theme';

export interface QualityPreset {
  tier: QualityTier;
  pixelRatio: number;
  shadows: boolean;
  /** Límite de ancho de textura para miniaturas de la espiral */
  textureMax: number;
  /** Si usar antialias en el WebGLRenderer */
  antialias: boolean;
  anisotropy: number;
}

const BASE: Record<QualityTier, QualityPreset> = {
  high: { tier: 'high', pixelRatio: 1.5, shadows: true, textureMax: 1600, antialias: true, anisotropy: 8 },
  medium: { tier: 'medium', pixelRatio: Math.min(1.5, 2), shadows: false, textureMax: 1024, antialias: true, anisotropy: 4 },
  low: { tier: 'low', pixelRatio: 1, shadows: false, textureMax: 720, antialias: false, anisotropy: 1 },
};

export function getQuality(caps: Capabilities): QualityPreset {
  const preset = BASE[caps.tier];
  return {
    ...preset,
    pixelRatio: Math.min(preset.pixelRatio, caps.dpr, 2),
  };
}
