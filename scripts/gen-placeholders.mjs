import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectsPath = resolve(root, 'src/content/projects.json');

const W = 1600;
const H = 1100;

function palette(accent) {
  return { accent: accent ?? '#b4553f' };
}

function svg({ title, label, index, total, accent, variant }) {
  const angle = (index / Math.max(total, 1)) * 360 + variant * 24;
  const gradId = `g${index}${variant}`;
  const noise = [];
  for (let i = 0; i < 42; i++) {
    const x = (i * 137.5 + variant * 53 + index * 97) % W;
    const y = (i * 89.3 + variant * 31 + index * 61) % H;
    const r = 18 + ((i * 7 + variant * 11) % 90);
    const o = 0.03 + ((i % 5) * 0.012);
    noise.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${accent}" opacity="${o.toFixed(3)}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="${gradId}" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0" stop-color="#f6f2ec"/>
      <stop offset="0.55" stop-color="#ece5db"/>
      <stop offset="1" stop-color="#e0d6c8"/>
    </linearGradient>
    <radialGradient id="${gradId}b" cx="0.2" cy="0.15" r="0.9">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${gradId})"/>
  <rect width="${W}" height="${H}" fill="url(#${gradId}b)"/>
  ${noise.join('\n  ')}
  <g fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.35">
    <rect x="70" y="70" width="${W - 140}" height="${H - 140}" rx="18"/>
  </g>
  <text x="120" y="${H - 150}" font-family="Georgia, 'Times New Roman', serif" font-size="86" fill="#1a1714" font-weight="500">${escapeXml(title)}</text>
  <text x="122" y="${H - 100}" font-family="Helvetica, Arial, sans-serif" font-size="30" letter-spacing="4" fill="#6b635b">${escapeXml(label.toUpperCase())}</text>
  <text x="${W - 120}" y="150" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="28" letter-spacing="3" fill="#6b635b">0${variant + 1}</text>
</svg>`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function main() {
  const data = await readJson(projectsPath);
  let count = 0;

  for (let p = 0; p < data.length; p++) {
    const project = data[p];
    // Solo se generan placeholders para proyectos sin medios reales (cover SVG).
    if (!project.cover.endsWith('.svg')) continue;
    const dir = resolve(root, 'public/media', project.id);
    await mkdir(dir, { recursive: true });
    const accent = palette(project.accent).accent;

    await writeFile(
      resolve(dir, 'cover.svg'),
      svg({ title: project.title, label: project.category, index: p, total: data.length, accent, variant: 0 }),
    );

    project.media.forEach((_, i) => {
      const file = resolve(dir, `0${i + 1}.svg`);
      void writeFile(
        file,
        svg({
          title: project.title,
          label: `${project.category} · ${i + 1}`,
          index: p,
          total: data.length,
          accent,
          variant: i + 1,
        }),
      );
      count++;
    });
    count++;
  }

  // Foto de perfil placeholder (se omite si ya existe la foto real)
  const profileDir = resolve(root, 'public/media/profile');
  await mkdir(profileDir, { recursive: true });
  const profilePhoto = resolve(profileDir, 'alejandra.jpg');
  if (!existsSync(profilePhoto)) {
    await writeFile(
      resolve(profileDir, 'alejandra.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720" role="img" aria-label="Retrato de Alejandra Mendivelso">
  <defs>
    <linearGradient id="pg" gradientTransform="rotate(35 0.5 0.5)">
      <stop offset="0" stop-color="#f6f2ec"/>
      <stop offset="1" stop-color="#d9cdbd"/>
    </linearGradient>
  </defs>
  <rect width="720" height="720" fill="url(#pg)"/>
  <circle cx="360" cy="300" r="130" fill="#b4553f" opacity="0.14"/>
  <circle cx="360" cy="280" r="96" fill="#1a1714" opacity="0.12"/>
  <path d="M170 720c0-120 85-210 190-210s190 90 190 210z" fill="#1a1714" opacity="0.12"/>
  <text x="360" y="690" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="#6b635b">Alejandra Mendivelso</text>
</svg>`,
    );
    count++;
  }

  console.log(`Generados ${count} placeholders SVG en public/media/`);
}

async function readJson(path) {
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(path, 'utf8'));
}

main();
