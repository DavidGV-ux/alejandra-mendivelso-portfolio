import { el } from './dom';

/** Anchos de las variantes generadas por `npm run optimize:media`. */
export const MEDIA_WIDTHS = [640, 1280, 1920] as const;

const RASTER_RE = /\.(jpe?g|png|webp|avif|tiff)$/i;

export function isLocalMedia(url: string): boolean {
  return url.startsWith('/media/');
}

/** Solo los raster locales tienen variantes @width generadas. */
export function hasRasterVariants(url: string): boolean {
  return isLocalMedia(url) && RASTER_RE.test(url);
}

function variantUrl(url: string, width: number, ext: string): string {
  const base = url.replace(/\.[^./]+$/, '');
  return `${base}@${width}.${ext}`;
}

/** Variante raster más cercana (sin quedarse corta) para una textura 3D. */
export function mediaVariant(url: string, maxSize: number, ext: 'webp' | 'avif'): string {
  if (!hasRasterVariants(url)) return url;
  const width = MEDIA_WIDTHS.find((w) => w >= maxSize) ?? MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1]!;
  return variantUrl(url, width, ext);
}

export function mediaSrcSet(url: string, ext: 'webp' | 'avif'): string | null {
  if (!hasRasterVariants(url)) return null;
  return MEDIA_WIDTHS.map((w) => `${variantUrl(url, w, ext)} ${w}w`).join(', ');
}

export interface ResponsiveImage {
  el: HTMLElement;
  img: HTMLImageElement;
}

/**
 * `<img>` simple para SVG (o medios remotos) y `<picture>` con AVIF/WebP
 * cuando existen variantes locales. Conserva el fallback al original.
 */
export function createResponsiveImage(options: {
  src: string;
  alt: string;
  sizes: string;
  className: string;
  width: number;
  height: number;
}): ResponsiveImage {
  const img = el('img', {
    class: options.className,
    attrs: {
      src: options.src,
      alt: options.alt,
      loading: 'lazy',
      decoding: 'async',
      width: String(options.width),
      height: String(options.height),
    },
  });

  const avif = mediaSrcSet(options.src, 'avif');
  const webp = mediaSrcSet(options.src, 'webp');
  if (!avif || !webp) return { el: img, img };

  const picture = el('picture');
  picture.append(
    el('source', {
      attrs: { type: 'image/avif', srcset: avif, sizes: options.sizes },
    }),
    el('source', {
      attrs: { type: 'image/webp', srcset: webp, sizes: options.sizes },
    }),
    img,
  );
  return { el: picture, img };
}
