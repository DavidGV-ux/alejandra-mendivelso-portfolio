import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

export interface CoverVideoHandle {
  texture: CanvasTexture;
  ready: Promise<void>;
  isReady: () => boolean;
  /** Reproduce o pausa el video (solo debe sonar/verse cuando su marco está activo). */
  setPlaying: (playing: boolean) => void;
  dispose: () => void;
}

export interface CoverVideoOptions {
  /** Ancho máximo del canvas de preview. La altura sigue el aspecto del video. */
  maxWidth?: number;
  /** Tope de fotogramas subidos a la GPU por segundo. */
  fps?: number;
}

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback: (cb: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

function hasFrameCallback(video: HTMLVideoElement): video is VideoWithFrameCallback {
  return typeof (video as VideoWithFrameCallback).requestVideoFrameCallback === 'function';
}

function even(n: number): number {
  const rounded = Math.max(2, Math.round(n));
  return rounded + (rounded % 2);
}

/**
 * Vista previa del video para el corredor 3D. El decoder nativo trabaja a
 * resolución de fuente; a la GPU solo se sube un canvas limitado por calidad
 * (y a un tope de fps), para que el marco se vea nítido sin multiplicar el
 * coste cuando hay varios videos activos.
 */
export function createCoverVideo(
  url: string,
  onFrame: () => void,
  options: CoverVideoOptions = {},
): CoverVideoHandle {
  const maxWidth = options.maxWidth ?? 768;
  const frameInterval = 1000 / Math.max(1, options.fps ?? 18);

  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.autoplay = false;
  video.playsInline = true;
  video.preload = 'metadata';
  video.setAttribute('aria-hidden', 'true');
  video.src = url;
  video.load();

  let drawW = even(Math.min(maxWidth, 1024));
  let drawH = even(drawW * (9 / 16));

  const canvas = document.createElement('canvas');
  canvas.width = drawW;
  canvas.height = drawH;
  const rawCtx =
    canvas.getContext('2d', { alpha: false, desynchronized: true }) ??
    canvas.getContext('2d', { alpha: false });
  if (!rawCtx) throw new Error('No se pudo crear el contexto 2D del cover de video');
  const ctx: CanvasRenderingContext2D = rawCtx;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = true;

  function fitCanvasToVideo(): void {
    const srcW = video.videoWidth || drawW;
    const srcH = video.videoHeight || drawH;
    const scale = Math.min(1, maxWidth / srcW);
    drawW = even(srcW * scale);
    drawH = even(srcH * scale);
    if (canvas.width !== drawW || canvas.height !== drawH) {
      canvas.width = drawW;
      canvas.height = drawH;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
  }

  function blit(): void {
    ctx.drawImage(video, 0, 0, drawW, drawH);
    texture.needsUpdate = true;
  }

  let ready = false;
  const readyPromise = new Promise<void>((resolve, reject) => {
    video.addEventListener(
      'loadeddata',
      () => {
        ready = true;
        fitCanvasToVideo();
        blit();
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
  let rvfcId = 0;
  let lastTime = -1;
  let lastUpdate = 0;
  let playing = false;

  const pump = (): void => {
    rafId = 0;
    if (document.hidden || video.paused || video.ended || !playing) return;
    const now = performance.now();
    if (video.currentTime !== lastTime && now - lastUpdate >= frameInterval) {
      lastTime = video.currentTime;
      lastUpdate = now;
      blit();
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
    if (rvfcId && hasFrameCallback(video)) {
      video.cancelVideoFrameCallback?.(rvfcId);
    }
    rvfcId = 0;
  };

  const tryPlay = (): void => {
    void video.play().then(startPump).catch(() => {});
  };

  const onRvfc = (): void => {
    rvfcId = 0;
    if (!playing || document.hidden) return;
    const now = performance.now();
    if (now - lastUpdate >= frameInterval) {
      lastUpdate = now;
      blit();
      onFrame();
    }
    if (hasFrameCallback(video)) {
      rvfcId = video.requestVideoFrameCallback(onRvfc);
    }
  };

  const onVisibility = (): void => {
    if (document.hidden) {
      video.pause();
      stopPump();
    } else if (ready && playing) {
      tryPlay();
    }
  };

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
        lastUpdate = 0;
        const play = video.play().catch(() => {});
        if (hasFrameCallback(video)) {
          rvfcId = video.requestVideoFrameCallback(onRvfc);
        } else {
          void play.then(startPump);
        }
      } else {
        video.pause();
        stopPump();
      }
    },
    dispose(): void {
      document.removeEventListener('visibilitychange', onVisibility);
      playing = false;
      stopPump();
      video.pause();
      video.removeAttribute('src');
      video.load();
      texture.dispose();
    },
  };
}
