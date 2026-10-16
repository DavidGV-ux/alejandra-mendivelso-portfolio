import type { Dictionary } from '@/config/i18n';
import type { Profile } from '@/types/profile';
import type { Project } from '@/types/project';
import type { Store } from '@/state/store';
import type { Section } from '@/state/store';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface UIActions {
  goToSection: (section: Section) => void;
  step: (delta: number) => void;
  goToIndex: (index: number) => void;
  /** Centra el proyecto activo y, si ya está centrado, abre su detalle. */
  openActive: () => void;
  openDetail: (projectId: string) => void;
  closeDetail: () => void;
  toggleTheme: () => void;
  cycleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  toggleLocale: () => void;
  openHelp: () => void;
  closeHelp: () => void;
}

export interface UIMusic {
  isPlaying: () => boolean;
  toggle: () => boolean;
  setOnChange: (fn: (playing: boolean) => void) => void;
}

export interface UIContext {
  dict: Dictionary;
  profile: Profile;
  projects: Project[];
  store: Store;
  actions: UIActions;
  music: UIMusic;
  currentThemeMode: () => ThemeMode;
  currentLocale: () => 'es' | 'en';
}

export interface UIComponent {
  el: HTMLElement;
  update?: () => void;
  dispose?: () => void;
}

export type { Section };
