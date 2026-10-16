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
  let raf = 0;
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

  // Animated path (Chromium): decode individual frames.
  if ('ImageDecoder' in window) {
    (async () => {
      try {
        await ready;
        const res = await fetch(url);
        const blob = await res.blob();
        const decoder = new (window as any).ImageDecoder({ data: blob, type: 'image/webp' });
        const track = decoder.tracks.selectedTrack;
        const frameCount = Math.max(1, track?.frameCount || 1);
        const frameDuration = Math.max(16, (track?.frameDuration || 20000) / 1000);
        let i = 0;
        const step = async () => {
          if (!running) return;
          try {
            const result = await decoder.decode({ frameIndex: i });
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
            i = (i + 1) % frameCount;
            window.setTimeout(step, frameDuration);
          } catch {
            window.setTimeout(step, frameDuration);
          }
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
      cancelAnimationFrame(raf);
      try { (window as any).ImageDecoder && null; } catch {}
      texture.dispose();
    },
  };
}
" path">
src/scene/coverWebp.ts