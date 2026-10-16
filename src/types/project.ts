export type MediaKind = 'image' | 'video' | 'glb';

export interface MediaItem {
  kind: MediaKind;
  /** Ruta relativa a /public, p. ej. /media/aurora/01.avif */
  src: string;
  /** Poster para videos (obligatorio si kind === 'video') */
  poster?: string;
  alt?: string;
  /** Subtítulos WebVTT para videos */
  captions?: string;
  width?: number;
  height?: number;
}

export interface ProjectLink {
  label: string;
  url: string;
}

export interface Project {
  id: string;
  title: string;
  category: string;
  year: number;
  description: string;
  role: string;
  tools: string[];
  cover: string;
  /** Video en bucle para el marco 3D; `cover` actúa como póster.
   *  Ruta única o variantes `light`/`dark` según el tema activo. */
  coverVideo?: string | { light?: string; dark?: string };
  media: MediaItem[];
  links: ProjectLink[];
  order: number;
  /** Color de acento opcional (hex) que sobrescribe el del tema para este proyecto */
  accent?: string;
  client?: string;
}
