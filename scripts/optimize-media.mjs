import { mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mediaDir = resolve(root, 'public/media');

const WIDTHS = [640, 1280, 1920];
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.webp', '.avif']);
const FORCE = process.argv.includes('--force');

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn(
    'sharp no está instalado. Ejecuta `npm install` para usar la optimización de imágenes.',
  );
  process.exit(0);
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

async function processImage(file) {
  const ext = extname(file).toLowerCase();
  if (!IMAGE_EXT.has(ext)) return { generated: 0, fresh: 0 };
  if (file.includes('@')) return { generated: 0, fresh: 0 }; // ya generadas

  const base = file.slice(0, -ext.length);
  const sourceStat = await stat(file);
  let generated = 0;
  let fresh = 0;

  for (const width of WIDTHS) {
    for (const [format, options] of [
      ['avif', { quality: 62 }],
      ['webp', { quality: 78 }],
    ]) {
      const target = `${base}@${width}.${format}`;
      if (!FORCE) {
        const targetStat = await stat(target).catch(() => null);
        if (targetStat && targetStat.mtimeMs >= sourceStat.mtimeMs) {
          fresh += 1;
          continue;
        }
      }
      await sharp(file).resize({ width, withoutEnlargement: true })[format](options).toFile(target);
      generated += 1;
    }
  }
  return { generated, fresh };
}

async function main() {
  const exists = await stat(mediaDir).catch(() => null);
  if (!exists) {
    console.log('No hay carpeta public/media. Nada que optimizar.');
    return;
  }

  const files = await walk(mediaDir);
  let total = 0;
  let upToDate = 0;
  for (const file of files) {
    const { generated, fresh } = await processImage(file);
    if (generated > 0) console.log(`✓ ${file.replace(root + '/', '')}`);
    total += generated;
    upToDate += fresh;
  }
  await mkdir(mediaDir, { recursive: true });
  console.log(`\n${total} variantes generadas (avif + webp), ${upToDate} al día.`);
  console.log('Usa --force para regenerar todo.');
  console.log('Para videos usa ffmpeg:');
  console.log('  ffmpeg -i input.mp4 -vcodec libx264 -crf 23 -vf scale=1280:-2 output.mp4');
  console.log('  ffmpeg -i input.mp4 -vcodec libvpx-vp9 -crf 32 -b:v 0 output.webm');
}

main();
