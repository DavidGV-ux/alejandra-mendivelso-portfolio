import { describe, expect, it } from 'vitest';
import generated from '@/content/generated/content.json';
import {
  experienceListSchema,
  profileCoreSchema,
  projectsSchema,
  statsSchema,
} from '@/content/schema';

const content = generated as {
  projects: Array<Record<string, unknown>>;
  profile: Record<string, unknown>;
};

describe('contenido generado', () => {
  it('los proyectos validan contra el schema', () => {
    const result = projectsSchema.safeParse(content.projects);
    if (!result.success) console.error(result.error.issues);
    expect(result.success).toBe(true);
  });

  it('el perfil valida contra el schema (core, stats y experiencia)', () => {
    const { stats, experience, ...core } = content.profile;
    const coreResult = profileCoreSchema.safeParse(core);
    if (!coreResult.success) console.error(coreResult.error.issues);
    expect(coreResult.success).toBe(true);
    expect(statsSchema.safeParse(stats).success).toBe(true);
    expect(experienceListSchema.safeParse(experience).success).toBe(true);
  });

  it('los defaults del schema quedan normalizados', () => {
    for (const project of content.projects) {
      expect(Array.isArray(project.tools)).toBe(true);
      expect(Array.isArray(project.media)).toBe(true);
      expect(Array.isArray(project.links)).toBe(true);
    }
    expect(Array.isArray(content.profile.socials)).toBe(true);
    expect(Array.isArray(content.profile.skills)).toBe(true);
    expect(Array.isArray(content.profile.aboutCards)).toBe(true);
  });

  it('los ids son únicos y los proyectos están ordenados', () => {
    const ids = content.projects.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const orders = content.projects.map((p) => p.order as number);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });
});
