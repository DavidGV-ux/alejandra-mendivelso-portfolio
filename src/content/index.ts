import type { z } from 'zod';
import type { Profile } from '@/types/profile';
import type { Project } from '@/types/project';
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

export interface Content {
  projects: Project[];
  profile: Profile;
}

type SafeResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

function validateOrThrow<T>(source: string, result: SafeResult<T>): T {
  if (result.success) return result.data;
  const message = formatZodError(source, result.error);
  console.error(message);
  throw new Error(message);
}

/**
 * Carga y valida todo el contenido JSON. Devuelve los proyectos ordenados
 * y el perfil compuesto (core + stats + experience).
 */
export function loadContent(): Content {
  const projects = validateOrThrow('projects.json', projectsSchema.safeParse(projectsJson));
  const core = validateOrThrow(
    'profile.json',
    profileCoreSchema.safeParse(profileJson),
  );
  const stats = validateOrThrow('stats.json', statsSchema.safeParse(statsJson));
  const experience = validateOrThrow(
    'experience.json',
    experienceListSchema.safeParse(experienceJson),
  );

  const sorted = [...projects].sort((a, b) => a.order - b.order);

  const profile: Profile = { ...core, stats, experience };

  return { projects: sorted, profile };
}
