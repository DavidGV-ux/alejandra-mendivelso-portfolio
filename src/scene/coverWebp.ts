import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

export interface CoverWebpHandle {
  texture: CanvasTexture;
  ready: Promise<void>;
  dispose: () => void;
}

export function createCoverWebp(url: string, onFrame: () => void): CoverWebpHandle {
  const img = new Image();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = true;

  let raf = 0;
  let running = true;
  const ready = new Promise<void>((resolve) => {
    img.onload = () => {
      canvas.width = img.naturalWidth || 512;
      canvas.height = img.naturalHeight || 512;
      resolve();
    };
    img.onerror = () => resolve();
  });
  img.src = url;

  const pump = async () => {
    await ready;
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    texture.needsUpdate = true;
    onFrame();
    raf = requestAnimationFrame(pump);
  };
  raf = requestAnimationFrame(pump);

  return {
    texture,
    ready,
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      img.removeAttribute('src');
      texture.dispose();
    },
  };
}