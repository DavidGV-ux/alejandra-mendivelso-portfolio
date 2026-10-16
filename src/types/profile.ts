export interface Stat {
  label: string;
  value: string;
}

export interface ExperiencePoint {
  text: string;
}

export interface ExperienceItem {
  period: string;
  title: string;
  org: string;
  description?: string;
  /** Logros o aportes concretos del rol */
  points: ExperiencePoint[];
}

export interface SkillGroup {
  title: string;
  items: string[];
}

export interface SocialLink {
  label: string;
  url: string;
  /** Nombre de icono soportado por el renderer de UI */
  icon:
    | 'instagram'
    | 'linkedin'
    | 'behance'
    | 'whatsapp'
    | 'github'
    | 'mail'
    | 'dribbble'
    | 'x';
}

export interface CvFile {
  title: string;
  description: string;
  /** Ruta pública del PDF, p. ej. /cv/alejandra-mendivelso-cv-desarrollo.pdf */
  file: string;
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
  /** Nombre completo para documentos o metadatos */
  fullName?: string;
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
  skills: SkillGroup[];
  /** Hojas de vida disponibles para ver o descargar */
  cv: CvFile[];
  aboutCards: AboutCard[];
  /** Embed opcional de Cal.com, p. ej. "alejandra/30min" */
  calcom?: string;
}
