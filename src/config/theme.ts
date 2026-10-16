import type { ThemeColors, ThemeConfig, ThemeMode } from '@/types/theme';

const lightColors: ThemeColors = {
  bg: '#f5f5f5',
  bgElevated: '#ffffff',
  surface: '#ffffff',
  surface2: '#f0f0f0',
  text: '#111111',
  textMuted: '#737373',
  textFaint: '#9e9e9e',
  accent: '#4f5d00',
  accentContrast: '#ffffff',
  border: 'rgba(17, 17, 17, 0.12)',
  borderStrong: 'rgba(17, 17, 17, 0.26)',
  overlay: 'rgba(17, 17, 17, 0.5)',
  danger: '#a3341f',
  success: '#2f6b3f',
  fog: '#f5f5f5',
  frame: '#ffffff',
  frameBorder: '#111111',
};

const darkColors: ThemeColors = {
  bg: '#101014',
  bgElevated: '#17171c',
  surface: '#1c1c22',
  surface2: '#1c1c22',
  text: '#f8f6f2',
  textMuted: '#a7a5ae',
  textFaint: '#8a8894',
  accent: '#e1ff76',
  accentContrast: '#101014',
  border: 'rgba(248, 246, 242, 0.1)',
  borderStrong: 'rgba(248, 246, 242, 0.22)',
  overlay: 'rgba(6, 6, 10, 0.66)',
  danger: '#ff8a8a',
  success: '#8ce99a',
  fog: '#101014',
  frame: '#1c1c22',
  frameBorder: '#f8f6f2',
};

/**
 * Configuración visual central. Cambia aquí y toda la app (CSS + WebGL) se actualiza.
 */
export const theme: ThemeConfig = {
  colors: lightColors,
  fonts: {
    display: "'Space Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif",
    body: "'Space Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif",
    meta: "'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  radii: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    pill: '999px',
  },
  shadows: {
    soft: '0 1px 2px rgba(0, 0, 0, 0.02), 0 4px 12px rgba(0, 0, 0, 0.04)',
    medium: '0 6px 20px rgba(0, 0, 0, 0.06)',
    strong: '0 20px 60px rgba(0, 0, 0, 0.08)',
  },
  motion: {
    duration: 0.5,
    ease: 'power2.out',
    easeInOut: 'power2.inOut',
  },
  cameraTransition: 0.8,
  fogDensity: 0.012,
  spiralTurns: 1.4,
  frameSpacing: 2.6,
  spiralRadius: 10,
};

export function getPalette(mode: Exclude<ThemeMode, 'auto'>): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors;
}

export function resolveMode(
  mode: ThemeMode,
  prefersDark: boolean,
): Exclude<ThemeMode, 'auto'> {
  if (mode === 'auto') return prefersDark ? 'dark' : 'light';
  return mode;
}

const COLOR_VARS: Record<keyof ThemeColors, string> = {
  bg: '--color-bg',
  bgElevated: '--color-bg-elevated',
  surface: '--color-surface',
  surface2: '--color-surface-2',
  text: '--color-text',
  textMuted: '--color-text-muted',
  textFaint: '--color-text-faint',
  accent: '--color-accent',
  accentContrast: '--color-accent-contrast',
  border: '--color-border',
  borderStrong: '--color-border-strong',
  overlay: '--color-overlay',
  danger: '--color-danger',
  success: '--color-success',
  fog: '--color-fog',
  frame: '--color-frame',
  frameBorder: '--color-frame-border',
};

export function applyThemeVariables(mode: Exclude<ThemeMode, 'auto'>): void {
  const root = document.documentElement;
  const palette = getPalette(mode);

  (Object.keys(palette) as Array<keyof ThemeColors>).forEach((key) => {
    root.style.setProperty(COLOR_VARS[key], palette[key]);
  });

  root.style.setProperty('--font-display', theme.fonts.display);
  root.style.setProperty('--font-body', theme.fonts.body);
  root.style.setProperty('--font-meta', theme.fonts.meta);
  root.style.setProperty('--radius-sm', theme.radii.sm);
  root.style.setProperty('--radius-md', theme.radii.md);
  root.style.setProperty('--radius-lg', theme.radii.lg);
  root.style.setProperty('--radius-pill', theme.radii.pill);
  root.style.setProperty('--shadow-soft', theme.shadows.soft);
  root.style.setProperty('--shadow-medium', theme.shadows.medium);
  root.style.setProperty('--shadow-strong', theme.shadows.strong);
  root.style.setProperty('--duration', `${theme.motion.duration}s`);

  root.dataset.theme = mode;
  root.style.colorScheme = mode;
}

export type { ThemeMode } from '@/types/theme';
