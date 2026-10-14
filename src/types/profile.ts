export interface Stat {
  label: string;
  value: string;
}

export interface ExperienceItem {
  period: string;
  title: string;
  org: string;
  description?: string;
}

export interface Skill {
  name: string;
  /** 0–100 opcional para mostrar barra */
  level?: number;
}

export interface SocialLink {
  label: string;
  url: string;
  /** Nombre de icono soportado por el renderer de UI */
  icon: 'instagram' | 'linkedin' | 'behance' | 'whatsapp' | 'mail' | 'dribbble' | 'x';
}

export type AboutCardType =
  | 'profile'
  | 'bio'
  | 'stats'
  | 'experience'
  | 'skills'
  | 'text';

export interface AboutCard {
  type: AboutCardType;
  title?: string;
  /** Ancho en columnas de la grid de About (1–3) */
  span?: 1 | 2 | 3;
  /** Solo para type === 'text' */
  body?: string;
}

export interface Profile {
  name: string;
  role: string;
  location: string;
  tagline: string;
  bio: string;
  photo: string;
  email: string;
  phone?: string;
  socials: SocialLink[];
  stats: Stat[];
  experience: ExperienceItem[];
  skills: Skill[];
  aboutCards: AboutCard[];
  /** Embed opcional de Cal.com, p. ej. "alejandra/30min" */
  calcom?: string;
}
