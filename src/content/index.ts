import type { Profile } from '@/types/profile';
import type { Project } from '@/types/project';

import generatedContent from './generated/content.json';

export interface Content {
  projects: Project[];
  profile: Profile;
}

const content = generatedContent as unknown as Content;

/**
 * Devuelve el contenido ya validado y normalizado por `scripts/content-pipeline.mjs`
 * (prebuild/pretypecheck/predev y plugin de Vite). En desarrollo se revalida con
 * zod mediante un import dinámico que no entra en el bundle de producción.
 */
export async function loadContent(): Promise<Content> {
  if (import.meta.env.DEV) {
    const { assertValidContent } = await import('./devValidate');
    assertValidContent();
  }
  return content;
}
