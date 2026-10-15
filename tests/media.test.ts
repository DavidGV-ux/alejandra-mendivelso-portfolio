import { describe, expect, it } from 'vitest';
import {
  hasRasterVariants,
  isLocalMedia,
  mediaSrcSet,
  mediaVariant,
  MEDIA_WIDTHS,
} from '@/utils/media';

describe('utilidades de media', () => {
  it('detecta solo medios locales raster', () => {
    expect(isLocalMedia('/media/aurora/cover.jpg')).toBe(true);
    expect(hasRasterVariants('/media/aurora/cover.jpg')).toBe(true);
    expect(hasRasterVariants('/media/aurora/cover.webp')).toBe(true);
    expect(hasRasterVariants('/media/aurora/cover.svg')).toBe(false);
    expect(hasRasterVariants('https://cdn.example.com/cover.jpg')).toBe(false);
    expect(hasRasterVariants('/og-image.svg')).toBe(false);
  });

  it('genera srcset con las variantes del pipeline', () => {
    expect(mediaSrcSet('/media/trama/01.jpg', 'webp')).toBe(
      '/media/trama/01@640.webp 640w, /media/trama/01@1280.webp 1280w, /media/trama/01@1920.webp 1920w',
    );
    expect(mediaSrcSet('/media/trama/01.svg', 'webp')).toBeNull();
  });

  it('elige la variante 3D más cercana sin quedarse corta', () => {
    expect(mediaVariant('/media/trama/01.jpg', 720, 'webp')).toBe('/media/trama/01@1280.webp');
    expect(mediaVariant('/media/trama/01.jpg', 1024, 'webp')).toBe('/media/trama/01@1280.webp');
    expect(mediaVariant('/media/trama/01.jpg', 1600, 'webp')).toBe('/media/trama/01@1920.webp');
    expect(mediaVariant('/media/trama/01.jpg', 4000, 'webp')).toBe('/media/trama/01@1920.webp');
  });

  it('deja pasar SVG y URLs remotas sin tocar', () => {
    expect(mediaVariant('/media/trama/01.svg', 1600, 'webp')).toBe('/media/trama/01.svg');
    expect(mediaVariant('https://cdn.example.com/a.jpg', 1600, 'webp')).toBe(
      'https://cdn.example.com/a.jpg',
    );
  });

  it('los anchos están ordenados', () => {
    const widths = [...MEDIA_WIDTHS];
    expect([...widths].sort((a, b) => a - b)).toEqual(widths);
  });
});
