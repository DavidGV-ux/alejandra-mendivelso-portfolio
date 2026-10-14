import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = resolve(root, 'src/content');

const mediaItem = z.object({
  kind: z.enum(['image', 'video', 'glb']),
  src: z.string().min(1),
  poster: z.string().optional(),
  alt: z.string().optional(),
  captions: z.string().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
});

const project = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  category: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  client: z.string().optional(),
  role: z.string().min(1),
  description: z.string().min(1),
  tools: z.array(z.string()),
  cover: z.string().min(1),
  media: z.array(mediaItem),
  links: z.array(z.object({ label: z.string(), url: z.string().url() })),
  order: z.number(),
  accent: z.string().regex(/^#[0-9a-fA-F]{3,6}$/).optional(),
});

const profileCore = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  location: z.string().min(1),
  tagline: z.string().min(1),
  bio: z.string().min(1),
  photo: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  calcom: z.string().optional(),
  socials: z.array(
    z.object({
      label: z.string(),
      url: z.string().min(1),
      icon: z.enum(['instagram', 'linkedin', 'behance', 'whatsapp', 'mail', 'dribbble', 'x']),
    }),
  ),
  skills: z.array(z.object({ name: z.string(), level: z.number().min(0).max(100).optional() })),
  aboutCards: z.array(
    z.object({
      type: z.enum(['profile', 'bio', 'stats', 'experience', 'skills', 'text']),
      title: z.string().optional(),
      span: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      body: z.string().optional(),
    }),
  ),
});

const stats = z.array(z.object({ label: z.string(), value: z.string() }));
const experience = z.array(
  z.object({
    period: z.string(),
    title: z.string(),
    org: z.string(),
    description: z.string().optional(),
  }),
);

const checks = [
  ['projects.json', project.array(), resolve(contentDir, 'projects.json')],
  ['profile.json', profileCore, resolve(contentDir, 'profile.json')],
  ['stats.json', stats, resolve(contentDir, 'stats.json')],
  ['experience.json', experience, resolve(contentDir, 'experience.json')],
];

let ok = true;
const ids = new Set();

for (const [name, schema, path] of checks) {
  try {
    const data = JSON.parse(await readFile(path, 'utf8'));
    const result = schema.safeParse(data);
    if (!result.success) {
      ok = false;
      console.error(`✗ ${name}`);
      for (const issue of result.error.issues) {
        console.error(`   • ${issue.path.join('.') || '(raíz)'}: ${issue.message}`);
      }
    } else {
      console.log(`✓ ${name}`);
      if (name === 'projects.json') {
        for (const p of result.data) {
          if (ids.has(p.id)) {
            ok = false;
            console.error(`   • id duplicado: ${p.id}`);
          }
          ids.add(p.id);
        }
      }
    }
  } catch (error) {
    ok = false;
    console.error(`✗ ${name}: ${error.message}`);
  }
}

if (!ok) {
  console.error('\nValidación de contenido fallida. Corrige los errores anteriores.');
  process.exit(1);
}

console.log('\nContenido válido ✓');

// Sitemap automático
if (process.argv.includes('--sitemap')) {
  const { writeFile } = await import('node:fs/promises');
  const base = 'https://alejandramendivelso.com';
  const urls = ['/', '/about', '/contact', ...[...ids].map((id) => `/works/${id}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${base}${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
  await writeFile(resolve(root, 'public/sitemap.xml'), xml);
  console.log('sitemap.xml actualizado ✓');
}
