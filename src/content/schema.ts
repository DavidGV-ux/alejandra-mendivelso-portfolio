import { z } from 'zod';

const mediaItemSchema = z
  .object({
    kind: z.enum(['image', 'video', 'glb']),
    src: z.string().min(1),
    poster: z.string().optional(),
    alt: z.string().optional(),
    alt_en: z.string().optional(),
    captions: z.string().optional(),
    captions_en: z.string().optional(),
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
  category_en: z.string().min(1).optional(),
  year: z.number().int().min(1900).max(2100),
  client: z.string().optional(),
  client_en: z.string().optional(),
  role: z.string().min(1),
  role_en: z.string().min(1).optional(),
  description: z.string().min(1),
  description_en: z.string().min(1).optional(),
  tools: z.array(z.string()).default([]),
  cover: z.string().min(1),
  /** Video en bucle que reemplaza al cover en el marco 3D (el póster queda en `cover`) */
  coverVideo: z.string().min(1).optional(),
  media: z.array(mediaItemSchema).default([]),
  links: z
    .array(
      z.object({
        label: z.string().min(1),
        label_en: z.string().min(1).optional(),
        url: z.string().url(),
      }),
    )
    .default([]),
  order: z.number(),
  accent: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'accent debe ser un hex válido')
    .optional(),
});

export const projectsSchema = z.array(projectSchema);

const statSchema = z.object({
  label: z.string().min(1),
  label_en: z.string().min(1).optional(),
  value: z.string().min(1),
});
const experiencePointSchema = z.object({
  text: z.string().min(1),
  text_en: z.string().min(1).optional(),
});
const experienceSchema = z.object({
  period: z.string().min(1),
  period_en: z.string().min(1).optional(),
  title: z.string().min(1),
  title_en: z.string().min(1).optional(),
  org: z.string().min(1),
  org_en: z.string().min(1).optional(),
  description: z.string().optional(),
  description_en: z.string().optional(),
  points: z.array(experiencePointSchema).default([]),
});
const skillGroupSchema = z.object({
  title: z.string().min(1),
  title_en: z.string().min(1).optional(),
  items: z.array(z.string().min(1)).default([]),
});
const socialSchema = z.object({
  label: z.string().min(1),
  label_en: z.string().min(1).optional(),
  url: z.string().min(1),
  icon: z.enum([
    'instagram',
    'linkedin',
    'behance',
    'whatsapp',
    'github',
    'mail',
    'dribbble',
    'x',
  ]),
});
const cvFileSchema = z.object({
  title: z.string().min(1),
  title_en: z.string().min(1).optional(),
  description: z.string().min(1),
  description_en: z.string().min(1).optional(),
  file: z.string().min(1),
});
const aboutCardSchema = z.object({
  type: z.enum(['profile', 'bio', 'stats', 'experience', 'skills', 'text']),
  title: z.string().optional(),
  title_en: z.string().optional(),
  span: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  body: z.string().optional(),
  body_en: z.string().optional(),
});

export const profileCoreSchema = z.object({
  name: z.string().min(1),
  fullName: z.string().min(1).optional(),
  role: z.string().min(1),
  role_en: z.string().min(1).optional(),
  location: z.string().min(1),
  location_en: z.string().min(1).optional(),
  tagline: z.string().min(1),
  tagline_en: z.string().min(1).optional(),
  bio: z.string().min(1),
  bio_en: z.string().min(1).optional(),
  photo: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  calcom: z.string().optional(),
  socials: z.array(socialSchema).default([]),
  skills: z.array(skillGroupSchema).default([]),
  cv: z.array(cvFileSchema).default([]),
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
