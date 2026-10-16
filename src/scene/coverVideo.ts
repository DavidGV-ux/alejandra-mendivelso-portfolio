import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

export interface CoverVideoHandle {
  texture: CanvasTexture;
  ready: Promise<void>;
  isReady: () => boolean;
  /** Reproduce o pausa el video (solo debe sonar/verse cuando su marco está activo). */
  setPlaying: (playing: boolean) => void;
  dispose: () => void;
}

/**
 * Vista previa ligera del video para el corredor 3D. El video se decodifica en
 * un elemento <video> oculto y se pinta a baja resolución en un canvas, cuya
 * textura (<200×150 px) se sube a la GPU solo al hacer hover. La calidad
 * completa se reproduce en el detalle al abrir el proyecto.
 */
export function createCoverVideo(url: string, onFrame: () => void): CoverVideoHandle {
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.autoplay = false;
  video.playsInline = true;
  video.preload = 'metadata';
  video.setAttribute('aria-hidden', 'true');
  video.src = url;
  video.load();

  const PREVIEW_W = 480;
  const ASPECT = 1400 / 962;
  const PREVIEW_H = Math.round(PREVIEW_W / ASPECT);
  const canvas = document.createElement('canvas');
  canvas.width = PREVIEW_W;
  canvas.height = PREVIEW_H;
  const ctx = canvas.getContext('2d')!;

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = true;

  let ready = false;
  const readyPromise = new Promise<void>((resolve, reject) => {
    video.addEventListener(
      'loadeddata',
      () => {
        ready = true;
        ctx.drawImage(video, 0, 0, PREVIEW_W, PREVIEW_H);
        texture.needsUpdate = true;
        resolve();
      },
      { once: true },
    );
    video.addEventListener(
      'error',
      () => reject(new Error(`No se pudo cargar el video ${url}`)),
      { once: true },
    );
  });

  let rafId = 0;
  let lastTime = -1;
  let lastUpdate = 0;
  const FRAME_INTERVAL = 100; // ~10 fps

  const pump = (): void => {
    rafId = 0;
    if (document.hidden || video.paused || video.ended) return;
    const now = performance.now();
    if (video.currentTime !== lastTime && now - lastUpdate >= FRAME_INTERVAL) {
      lastTime = video.currentTime;
      lastUpdate = now;
      ctx.drawImage(video, 0, 0, PREVIEW_W, PREVIEW_H);
      texture.needsUpdate = true;
      onFrame();
    }
    rafId = requestAnimationFrame(pump);
  };

  const startPump = (): void => {
    if (!rafId) rafId = requestAnimationFrame(pump);
  };

  const stopPump = (): void => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const tryPlay = (): void => {
    void video.play().then(startPump).catch(() => {});
  };

  const onVisibility = (): void => {
    if (document.hidden) {
      video.pause();
      stopPump();
    } else if (ready && playing) {
      tryPlay();
    }
  };

  let playing = false;

  video.addEventListener('loadeddata', () => {
    if (playing) tryPlay();
  });
  document.addEventListener('visibilitychange', onVisibility);

  return {
    texture,
    ready: readyPromise,
    isReady: () => ready,
    setPlaying(next: boolean): void {
      if (next === playing) return;
      playing = next;
      if (!ready) return;
      if (next) {
        if (document.hidden) return;
        if ('requestVideoFrameCallback' in video && typeof (video as any).requestVideoFrameCallback === 'function') {
          const rvfcLoop = () => {
            if (!playing || document.hidden) return;
            ctx.drawImage(video, 0, 0, PREVIEW_W, PREVIEW_H);
            texture.needsUpdate = true;
            onFrame();
            (video as any).requestVideoFrameCallback(rvfcLoop);
          };
          (video as any).requestVideoFrameCallback(rvfcLoop);
          void video.play().catch(() => {});
        } else {
          void video.play().then(startPump).catch(() => {});
        }
      } else {
        video.pause();
        stopPump();
      }
    },
    dispose(): void {
      document.removeEventListener('visibilitychange', onVisibility);
      stopPump();
      video.pause();
      video.removeAttribute('src');
      video.load();
      texture.dispose();
    },
  };
}