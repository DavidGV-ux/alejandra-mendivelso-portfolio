export type QualityTier = 'high' | 'medium' | 'low';

export interface Capabilities {
  webgl: boolean;
  tier: QualityTier;
  deviceMemory: number;
  hardwareConcurrency: number;
  prefersReducedMotion: boolean;
  isTouch: boolean;
  dpr: number;
}

export interface ThemeColors {
  bg: string;
  bgElevated: string;
  surface: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentContrast: string;
  border: string;
  borderStrong: string;
  overlay: string;
  danger: string;
  success: string;
  fog: string;
  frame: string;
  frameBorder: string;
}

export interface ThemeFonts {
  display: string;
  body: string;
  meta: string;
}

export interface ThemeRadii {
  sm: string;
  md: string;
  lg: string;
  pill: string;
}

export interface ThemeShadows {
  soft: string;
  medium: string;
  strong: string;
}

export interface ThemeMotion {
  /** Duración base en segundos */
  duration: number;
  ease: string;
  easeInOut: string;
}

export interface ThemeConfig {
  colors: ThemeColors;
  fonts: ThemeFonts;
  radii: ThemeRadii;
  shadows: ThemeShadows;
  motion: ThemeMotion;
  /** Velocidad de la cámara por paso (segundos) */
  cameraTransition: number;
  /** Densidad de niebla 0–1 */
  fogDensity: number;
  /** Nº de vueltas de la hélice */
  spiralTurns: number;
  /** Separación vertical entre marcos */
  frameSpacing: number;
  /** Radio de la hélice */
  spiralRadius: number;
  accentForProject?: (accent: string | undefined) => string;
}

export type Locale = 'es' | 'en';

export type ThemeMode = 'light' | 'dark' | 'auto';
