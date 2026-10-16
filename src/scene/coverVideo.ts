import { SRGBColorSpace, VideoTexture } from 'three';

export interface CoverVideoHandle {
  texture: VideoTexture;
  ready: Promise<void>;
  isReady: () => boolean;
  /** Reproduce o pausa el video (solo debe sonar/verse cuando su marco está activo). */
  setPlaying: (playing: boolean) => void;
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
  video.autoplay = false;
  video.playsInline = true;
  video.preload = 'none';
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
  let lastUpdate = 0;
  const FRAME_INTERVAL = 66; // ~15 fps: baja la carga de decodificación/actualización

  const pump = (): void => {
    rafId = 0;
    if (document.hidden || video.paused || video.ended) return;
    const now = performance.now();
    if (video.currentTime !== lastTime && now - lastUpdate >= FRAME_INTERVAL) {
      lastTime = video.currentTime;
      lastUpdate = now;
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

  let playing = true;

  video.addEventListener('loadeddata', () => {
    if (playing) tryPlay();
  });
  document.addEventListener('visibilitychange', onVisibility);

  return {
    texture,
    ready: readyPromise,
    isReady: () => ready,
    setPlaying(next: boolean): void {
      playing = next;
      if (!ready) return;
      if (next) {
        if (document.hidden) return;
        void video.play().then(startPump).catch(() => {});
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
