import { LinearMipmapLinearFilter, LoadingManager, SRGBColorSpace, Texture } from 'three';

export interface LoaderHandle {
  manager: LoadingManager;
  loadTexture: (url: string, maxSize: number) => Promise<Texture>;
  loadGLTF: (url: string) => Promise<unknown>;
  getCached: (url: string) => Texture | undefined;
  release: (url: string) => void;
  dispose: () => void;
}

async function decodeImage(url: string, maxSize: number): Promise<TexImageSource> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar ${url} (${response.status})`);
  const blob = await response.blob();

  if (typeof createImageBitmap === 'function' && !url.endsWith('.svg')) {
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
  }

  return await new Promise<TexImageSource>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Imagen inválida: ${url}`));
    img.src = url;
  });
}

export function createLoader(): LoaderHandle {
  const manager = new LoadingManager();
  const cache = new Map<string, Texture>();
  const pending = new Map<string, Promise<Texture>>();

  async function loadTexture(url: string, maxSize: number): Promise<Texture> {
    const cached = cache.get(url);
    if (cached) return cached;
    const inflight = pending.get(url);
    if (inflight) return inflight;

    manager.itemStart(url);
    const task = (async () => {
      try {
        const image = await decodeImage(url, maxSize);
        const texture = new Texture(image);
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = 4;
        texture.needsUpdate = true;
        texture.generateMipmaps = true;
        texture.minFilter = LinearMipmapLinearFilter;
        cache.set(url, texture);
        return texture;
      } finally {
        manager.itemEnd(url);
      }
    })();

    pending.set(url, task);
    try {
      return await task;
    } finally {
      pending.delete(url);
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
