import { LinearMipmapLinearFilter, LoadingManager, SRGBColorSpace, Texture } from 'three';
import { mediaVariant } from '@/utils/media';

export interface LoaderHandle {
  manager: LoadingManager;
  loadTexture: (url: string, maxSize: number, anisotropy?: number) => Promise<Texture>;
  loadGLTF: (url: string) => Promise<unknown>;
  getCached: (url: string) => Texture | undefined;
  release: (url: string) => void;
  dispose: () => void;
}

async function decodeImage(url: string, maxSize: number): Promise<TexImageSource> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar ${url} (${response.status})`);
  const blob = await response.blob();

  // Para los covers JPG, preferimos el cargador tradicional de Image para evitar
  // problemas de inversión (flipY) y asegurar la carga inmediata.
  const isJpg = url.toLowerCase().includes('cover.jpg');
  
  if (typeof createImageBitmap === 'function' && !url.endsWith('.svg') && !isJpg) {
    try {
      const bitmap = await createImageBitmap(blob);
      if (bitmap.width <= maxSize) return bitmap;
      const scale = maxSize / bitmap.width;
      const resized = await createImageBitmap(bitmap, {
        resizeWidth: Math.round(bitmap.width * scale),
        resizeHeight: Math.round(bitmap.height * scale),
        resizeQuality: 'high',
      });
      bitmap.close();
      return resized;
    } catch (e) {
      console.warn(`createImageBitmap falló para ${url}, usando fallback Image`, e);
    }
  }

  // Fallback para SVG, entornos sin createImageBitmap o errores de decodificación.
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<TexImageSource>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Imagen inválida: ${url}`));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function createLoader(): LoaderHandle {
  const manager = new LoadingManager();
  const cache = new Map<string, Texture>();
  const pending = new Map<string, Promise<Texture>>();

  async function loadTexture(url: string, maxSize: number, anisotropy = 4): Promise<Texture> {
    // Los covers raster locales usan la variante WebP más cercana al límite.
    const resolved = mediaVariant(url, maxSize, 'webp');
    const cached = cache.get(resolved);
    if (cached) return cached;
    const inflight = pending.get(resolved);
    if (inflight) return inflight;

    manager.itemStart(resolved);
    const task = (async () => {
      try {
        const image = await decodeImage(resolved, maxSize);
        const texture = new Texture(image);
        texture.colorSpace = SRGBColorSpace;

        // Forzamos flipY=false para los covers JPG que están saliendo invertidos.
        // El estándar suele ser true, pero en este caso parece que el origen o la
        // decodificación los entrega ya orientados para WebGL.
        if (resolved.toLowerCase().includes('cover.jpg')) {
          texture.flipY = false;
        } else {
          texture.flipY = !(image instanceof ImageBitmap);
        }

        texture.anisotropy = anisotropy;
        texture.needsUpdate = true;
        texture.generateMipmaps = true;
        texture.minFilter = LinearMipmapLinearFilter;
        cache.set(resolved, texture);
        return texture;
      } finally {
        manager.itemEnd(resolved);
      }
    })();

    pending.set(resolved, task);
    try {
      return await task;
    } finally {
      pending.delete(resolved);
    }
  }

  async function loadGLTF(url: string): Promise<unknown> {
    manager.itemStart(url);
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader(manager);
      return await new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });
    } finally {
      manager.itemEnd(url);
    }
  }

  return {
    manager,
    loadTexture,
    loadGLTF,
    getCached: (url) => cache.get(url),
    release: (url) => {
      const tex = cache.get(url);
      if (tex) {
        tex.dispose();
        cache.delete(url);
      }
    },
    dispose: () => {
      cache.forEach((tex) => tex.dispose());
      cache.clear();
    },
  };
}
