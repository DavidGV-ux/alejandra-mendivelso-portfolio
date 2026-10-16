import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

export interface CoverWebpHandle {
  texture: CanvasTexture;
  ready: Promise<void>;
  dispose: () => void;
}

export function createCoverWebp(url: string, onFrame: () => void): CoverWebpHandle {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 512;
  canvas.height = 512;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = true;

  let running = true;
  const ready = new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth || canvas.width;
      canvas.height = img.naturalHeight || canvas.height;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      texture.needsUpdate = true;
      onFrame();
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });

  if ('ImageDecoder' in window) {
    (async () => {
      try {
        await ready;
        const res = await fetch(url);
        const blob = await res.blob();
        const decoder = new (window as any).ImageDecoder({ data: blob, type: 'image/webp' });
        const frameDuration = 100;
        const step = async () => {
          if (!running) return;
          try {
            const result = await decoder.decode();
            const image = result.image;
            if (canvas.width !== image.width || canvas.height !== image.height) {
              canvas.width = image.width;
              canvas.height = image.height;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            if (typeof image.close === 'function') image.close();
            texture.needsUpdate = true;
            onFrame();
          } catch {
            try { decoder.reset(); } catch {}
          }
          window.setTimeout(step, frameDuration);
        };
        await step();
      } catch (e) {
        console.warn('ImageDecoder fallback to static WebP', e);
      }
    })();
  }

  return {
    texture,
    ready,
    dispose() {
      running = false;
      texture.dispose();
    },
  };
}