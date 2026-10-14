import type { Capabilities, QualityTier } from '@/types/theme';

export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

function getDeviceMemory(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return nav.deviceMemory ?? 4;
}

function chooseTier(
  webgl: boolean,
  memory: number,
  cores: number,
  reducedMotion: boolean,
): QualityTier {
  if (!webgl) return 'low';
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 480;
  if (memory >= 8 && cores >= 8 && !smallScreen) return 'high';
  if (memory <= 2 || cores <= 2) return 'low';
  if (reducedMotion) return 'medium';
  return 'medium';
}

export function detectCapabilities(): Capabilities {
  const webgl = detectWebGL();
  const memory = getDeviceMemory();
  const cores = navigator.hardwareConcurrency || 4;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const dpr = window.devicePixelRatio || 1;

  return {
    webgl,
    deviceMemory: memory,
    hardwareConcurrency: cores,
    prefersReducedMotion,
    isTouch,
    dpr,
    tier: chooseTier(webgl, memory, cores, prefersReducedMotion),
  };
}
