/**
 * Pipeline de contenido: valida los JSON con el schema zod compartido
 * (src/content/schema.ts) y genera src/content/generated/content.json
 * ya normalizado (defaults aplicados, proyectos ordenados).
 *
 * Uso:
 *   node scripts/content-pipeline.mjs             → valida y genera
 *   node scripts/content-pipeline.mjs --sitemap   → además regenera el sitemap
 *   node scripts/content-pipeline.mjs --check     → solo valida (no escribe)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  experienceListSchema,
  formatZodError,
  profileCoreSchema,
  projectsSchema,
  statsSchema,
} from '../src/content/schema.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = resolve(root, 'src/content');
const generatedDir = resolve(contentDir, 'generated');
const generatedFile = resolve(generatedDir, 'content.json');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const withSitemap = args.includes('--sitemap');

async function readJson(name) {
  const raw = await readFile(resolve(contentDir, name), 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`[contenido] ${name} no es JSON válido: ${error.message}`);
  }
}

function parseOrThrow(source, result) {
  if (result.success) return result.data;
  const message = formatZodError(source, result.error);
  console.error(message);
  process.exitCode = 1;
  throw new Error(`Validación fallida: ${source}`);
}

function assertUniqueIds(projects) {
  const seen = new Set();
  for (const project of projects) {
    if (seen.has(project.id)) {
      throw new Error(`[contenido] id duplicado: ${project.id}`);
    }
    seen.add(project.id);
  }
  return seen;
}

/**
 * Resuelve un objeto (y sus anidados) a un idioma: para 'en' reemplaza cada
 * campo `x` por `x_en` cuando existe y elimina los sufijos `_en`.
 */
function localized(value, lang) {
  if (Array.isArray(value)) return value.map((item) => localized(item, lang));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      if (key.endsWith('_en')) continue;
      out[key] = lang === 'en' && value[`${key}_en`] !== undefined
        ? value[`${key}_en`]
        : localized(raw, lang);
    }
    return out;
  }
  return value;
}

function normalizeProfile(core, stats, experience) {
  const profile = {
    name: core.name,
    role: core.role,
    location: core.location,
    tagline: core.tagline,
    bio: core.bio,
    photo: core.photo,
    email: core.email,
    socials: core.socials,
    stats,
    experience,
    skills: core.skills,
    cv: core.cv,
    aboutCards: core.aboutCards,
  };
  if (core.fullName !== undefined) profile.fullName = core.fullName;
  if (core.phone !== undefined) profile.phone = core.phone;
  if (core.calcom !== undefined) profile.calcom = core.calcom;
  return profile;
}

function buildContent(lang, projects, profileCore, stats, experience) {
  const sorted = [...projects].sort((a, b) => a.order - b.order);
  return {
    projects: sorted.map((p) => localized(p, lang)),
    profile: normalizeProfile(
      localized(profileCore, lang),
      localized(stats, lang),
      localized(experience, lang),
    ),
  };
}

async function writeSitemap(ids) {
  const base = 'https://alejandramendivelso.com';
  const urls = ['/', '/about', '/contact', ...[...ids].map((id) => `/works/${id}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${base}${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
  await writeFile(resolve(root, 'public/sitemap.xml'), xml);
  console.log('sitemap.xml actualizado ✓');
}

export async function runContentPipeline({ silent = false } = {}) {
  const [projectsRaw, profileRaw, statsRaw, experienceRaw] = await Promise.all([
    readJson('projects.json'),
    readJson('profile.json'),
    readJson('stats.json'),
    readJson('experience.json'),
  ]);

  const projects = parseOrThrow('projects.json', projectsSchema.safeParse(projectsRaw));
  const profileCore = parseOrThrow(
    'profile.json',
    profileCoreSchema.safeParse(profileRaw),
  );
  const stats = parseOrThrow('stats.json', statsSchema.safeParse(statsRaw));
  const experience = parseOrThrow(
    'experience.json',
    experienceListSchema.safeParse(experienceRaw),
  );

  const ids = assertUniqueIds(projects);

  const content = {
    ...buildContent('es', projects, profileCore, stats, experience),
    en: buildContent('en', projects, profileCore, stats, experience),
  };

  if (!checkOnly) {
    await mkdir(generatedDir, { recursive: true });
    await writeFile(generatedFile, `${JSON.stringify(content, null, 2)}\n`);
  }

  if (withSitemap) await writeSitemap(ids);

  if (!silent) {
    console.log(
      `Contenido válido ✓${checkOnly ? '' : ` → ${generatedFile.replace(`${root}/`, '')}`}`,
    );
  }

  return content;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runContentPipeline().catch((error) => {
    if (process.exitCode !== 1) console.error(error.message);
    process.exit(1);
  });
}
