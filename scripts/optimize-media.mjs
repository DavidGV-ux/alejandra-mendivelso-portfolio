import { mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mediaDir = resolve(root, 'public/media');

const WIDTHS = [640, 1280, 1920];
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.webp', '.avif']);

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
  if (!IMAGE_EXT.has(ext)) return 0;
  if (file.includes('@')) return 0; // ya generadas

  const base = file.slice(0, -ext.length);
  let generated = 0;

  for (const width of WIDTHS) {
    const pipeline = sharp(file).resize({ width, withoutEnlargement: true });
    await pipeline.clone().avif({ quality: 62 }).toFile(`${base}@${width}.avif`);
    await pipeline.clone().webp({ quality: 78 }).toFile(`${base}@${width}.webp`);
    generated += 2;
  }
  return generated;
}

async function main() {
  const exists = await stat(mediaDir).catch(() => null);
  if (!exists) {
    console.log('No hay carpeta public/media. Nada que optimizar.');
    return;
  }

  const files = await walk(mediaDir);
  let total = 0;
  for (const file of files) {
    const count = await processImage(file);
    if (count > 0) console.log(`✓ ${file.replace(root + '/', '')}`);
    total += count;
  }
  await mkdir(mediaDir, { recursive: true });
  console.log(`\n${total} variantes generadas (avif + webp).`);
  console.log('Para videos usa ffmpeg:');
  console.log('  ffmpeg -i input.mp4 -vcodec libx264 -crf 23 -vf scale=1280:-2 output.mp4');
  console.log('  ffmpeg -i input.mp4 -vcodec libvpx-vp9 -crf 32 -b:v 0 output.webm');
}

main();
