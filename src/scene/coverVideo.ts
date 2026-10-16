import { SRGBColorSpace, VideoTexture } from 'three';

export interface CoverVideoHandle {
  texture: VideoTexture;
  ready: Promise<void>;
  isReady: () => boolean;
  dispose: () => void;
}

/**
 * Textura de video para los covers del corredor. Se reproduce en silencio y
 * en bucle; cuando el frame decodificado cambia, marca la textura para
 * actualizar y despierta el loop bajo demanda mediante `onFrame`. Se pausa
 * cuando la pestaña queda oculta.
 */
export function createCoverVideo(url: string, onFrame: () => void): CoverVideoHandle {
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.autoplay = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true');
  video.src = url;

  const texture = new VideoTexture(video);
  texture.colorSpace = SRGBColorSpace;

  let ready = false;
  const readyPromise = new Promise<void>((resolve, reject) => {
    video.addEventListener(
      'loadeddata',
      () => {
        ready = true;
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

  const pump = (): void => {
    rafId = 0;
    if (document.hidden || video.paused || video.ended) return;
    if (video.currentTime !== lastTime) {
      lastTime = video.currentTime;
      texture.needsUpdate = true;
      onFrame();
    }
    rafId = requestAnimationFrame(pump);
  };

  const startPump = (): void => {
    if (!rafId) rafId = requestAnimationFrame(pump);
  };

  const tryPlay = (): void => {
    void video.play().then(startPump).catch(() => {});
  };

  const onVisibility = (): void => {
    if (document.hidden) {
      video.pause();
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (ready) {
      tryPlay();
    }
  };

  video.addEventListener('loadeddata', tryPlay, { once: true });
  document.addEventListener('visibilitychange', onVisibility);

  return {
    texture,
    ready: readyPromise,
    isReady: () => ready,
    dispose(): void {
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(rafId);
      video.pause();
      video.removeAttribute('src');
      video.load();
      texture.dispose();
    },
  };
}
