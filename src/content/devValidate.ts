/**
 * Validación de contenido en desarrollo. Este módulo importa zod y solo se
 * carga dinámicamente cuando `import.meta.env.DEV` es true, por lo que no
 * forma parte del bundle de producción.
 */
import {
  experienceListSchema,
  formatZodError,
  profileCoreSchema,
  projectsSchema,
  statsSchema,
} from './schema';

import projectsJson from './projects.json';
import profileJson from './profile.json';
import statsJson from './stats.json';
import experienceJson from './experience.json';

function parseOrThrow<T>(
  source: string,
  result: { success: true; data: T } | { success: false; error: import('zod').ZodError },
): T {
  if (result.success) return result.data;
  const message = formatZodError(source, result.error);
  console.error(message);
  throw new Error(message);
}

export function assertValidContent(): void {
  parseOrThrow('projects.json', projectsSchema.safeParse(projectsJson));
  parseOrThrow('profile.json', profileCoreSchema.safeParse(profileJson));
  parseOrThrow('stats.json', statsSchema.safeParse(statsJson));
  parseOrThrow('experience.json', experienceListSchema.safeParse(experienceJson));
}
