import type { ThemeColors, ThemeConfig, ThemeMode } from '@/types/theme';

const lightColors: ThemeColors = {
  bg: '#f6f2ec',
  bgElevated: '#fcfaf7',
  surface: '#ffffff',
  text: '#1a1714',
  textMuted: '#6b635b',
  textFaint: '#a39a90',
  accent: '#b4553f',
  accentContrast: '#ffffff',
  border: 'rgba(26, 23, 20, 0.10)',
  borderStrong: 'rgba(26, 23, 20, 0.22)',
  overlay: 'rgba(20, 17, 14, 0.55)',
  danger: '#a33b2c',
  success: '#3f7a4f',
  fog: '#ece5db',
  frame: '#fcfaf7',
  frameBorder: '#1a1714',
};

const darkColors: ThemeColors = {
  bg: '#141210',
  bgElevated: '#1c1916',
  surface: '#221e1a',
  text: '#f2ede6',
  textMuted: '#a69d93',
  textFaint: '#6e665d',
  accent: '#e08a6e',
  accentContrast: '#1a1714',
  border: 'rgba(242, 237, 230, 0.12)',
  borderStrong: 'rgba(242, 237, 230, 0.26)',
  overlay: 'rgba(10, 9, 8, 0.62)',
  danger: '#e2836f',
  success: '#6fae7f',
  fog: '#141210',
  frame: '#26221e',
  frameBorder: '#f2ede6',
};

/**
 * Configuración visual central. Cambia aquí y toda la app (CSS + WebGL) se actualiza.
 */
export const theme: ThemeConfig = {
  colors: lightColors,
  fonts: {
    display: "'Fraunces', 'Iowan Old Style', Georgia, serif",
    body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    meta: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  radii: {
    sm: '6px',
    md: '12px',
    lg: '18px',
    pill: '999px',
  },
  shadows: {
    soft: '0 2px 8px rgba(20, 17, 14, 0.06)',
    medium: '0 8px 24px rgba(20, 17, 14, 0.10)',
    strong: '0 20px 60px rgba(20, 17, 14, 0.18)',
  },
  motion: {
    duration: 0.6,
    ease: 'power3.out',
    easeInOut: 'power2.inOut',
  },
  cameraTransition: 1.0,
  fogDensity: 0.028,
  spiralTurns: 1.35,
  frameSpacing: 2.45,
  spiralRadius: 9.5,
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

/** Escribe todas las variables CSS en :root a partir del tema resuelto. */
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
