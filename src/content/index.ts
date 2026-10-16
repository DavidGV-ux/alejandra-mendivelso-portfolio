import type { Profile } from '@/types/profile';
import type { Project } from '@/types/project';

import generatedContent from './generated/content.json';

export interface Content {
  projects: Project[];
  profile: Profile;
}

type GeneratedContent = Content & { en?: Content };

const generated = generatedContent as unknown as GeneratedContent;

/**
 * Devuelve el contenido ya validado y normalizado por `scripts/content-pipeline.mjs`
 * (prebuild/pretypecheck/predev y plugin de Vite). En desarrollo se revalida con
 * zod mediante un import dinámico que no entra en el bundle de producción.
 */
export async function loadContent(locale: 'es' | 'en' = 'es'): Promise<Content> {
  if (import.meta.env.DEV) {
    const { assertValidContent } = await import('./devValidate');
    assertValidContent();
  }
  if (locale === 'en' && generated.en) return generated.en;
  return { projects: generated.projects, profile: generated.profile };
}
