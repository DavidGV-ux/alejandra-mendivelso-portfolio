import { z } from 'zod';

const mediaItemSchema = z
  .object({
    kind: z.enum(['image', 'video', 'glb']),
    src: z.string().min(1),
    poster: z.string().optional(),
    alt: z.string().optional(),
    captions: z.string().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  })
  .refine((m) => m.kind !== 'video' || !!m.poster, {
    message: 'Los videos requieren un campo "poster".',
    path: ['poster'],
  });

export const projectSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'El id debe ser minúsculas, números y guiones (slug).'),
  title: z.string().min(1),
  category: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  client: z.string().optional(),
  role: z.string().min(1),
  description: z.string().min(1),
  tools: z.array(z.string()).default([]),
  cover: z.string().min(1),
  media: z.array(mediaItemSchema).default([]),
  links: z.array(z.object({ label: z.string().min(1), url: z.string().url() })).default([]),
  order: z.number(),
  accent: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'accent debe ser un hex válido')
    .optional(),
});

export const projectsSchema = z.array(projectSchema);

const statSchema = z.object({ label: z.string().min(1), value: z.string().min(1) });
const experienceSchema = z.object({
  period: z.string().min(1),
  title: z.string().min(1),
  org: z.string().min(1),
  description: z.string().optional(),
});
const skillSchema = z.object({
  name: z.string().min(1),
  level: z.number().min(0).max(100).optional(),
});
const socialSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
  icon: z.enum(['instagram', 'linkedin', 'behance', 'whatsapp', 'mail', 'dribbble', 'x']),
});
const aboutCardSchema = z.object({
  type: z.enum(['profile', 'bio', 'stats', 'experience', 'skills', 'text']),
  title: z.string().optional(),
  span: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  body: z.string().optional(),
});

export const profileCoreSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  location: z.string().min(1),
  tagline: z.string().min(1),
  bio: z.string().min(1),
  photo: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  calcom: z.string().optional(),
  socials: z.array(socialSchema).default([]),
  skills: z.array(skillSchema).default([]),
  aboutCards: z.array(aboutCardSchema).default([]),
});

export const statsSchema = z.array(statSchema);
export const experienceListSchema = z.array(experienceSchema);

export type RawProject = z.infer<typeof projectSchema>;
export type RawProfileCore = z.infer<typeof profileCoreSchema>;

/** Formatea errores de zod en un mensaje legible para consola. */
export function formatZodError(source: string, error: z.ZodError): string {
  const issues = error.issues
    .map((i) => `  • ${i.path.join('.') || '(raíz)'}: ${i.message}`)
    .join('\n');
  return `[contenido] Error validando ${source}:\n${issues}`;
}
