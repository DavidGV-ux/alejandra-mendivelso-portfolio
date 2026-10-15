import type { ThemeColors, ThemeConfig, ThemeMode } from '@/types/theme';

const lightColors: ThemeColors = {
  bg: '#ffffff',
  bgElevated: '#fafafa',
  surface: '#ffffff',
  text: '#0f0f0f',
  textMuted: '#4f4f4f',
  textFaint: '#6b6b6b',
  accent: '#111111',
  accentContrast: '#ffffff',
  border: 'rgba(0, 0, 0, 0.08)',
  borderStrong: 'rgba(0, 0, 0, 0.16)',
  overlay: 'rgba(0, 0, 0, 0.4)',
  danger: '#b91c1c',
  success: '#15803d',
  fog: '#ffffff',
  frame: '#ffffff',
  frameBorder: '#0f0f0f',
};

const darkColors: ThemeColors = {
  bg: '#0a0a0a',
  bgElevated: '#151515',
  surface: '#1f1f1f',
  text: '#f5f5f5',
  textMuted: '#d4d4d4',
  textFaint: '#a3a3a3',
  accent: '#e5e5e5',
  accentContrast: '#0a0a0a',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  danger: '#ef4444',
  success: '#22c55e',
  fog: '#0a0a0a',
  frame: '#1f1f1f',
  frameBorder: '#f5f5f5',
};

/**
 * Configuración visual central. Cambia aquí y toda la app (CSS + WebGL) se actualiza.
 */
export const theme: ThemeConfig = {
  colors: lightColors,
  fonts: {
    display: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    meta: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
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
