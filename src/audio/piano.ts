import { siteConfig } from '@/config/site.config';

/** Pista de fondo del sitio. */
const TRACK_URL = '/audio/marriedlife.mp3';
const VOLUME = 0.45;
const FADE_MS = 700;

export interface Piano {
  isPlaying: () => boolean;
  /** Devuelve el estado resultante. */
  toggle: () => boolean;
  setOnChange: (fn: (playing: boolean) => void) => void;
  dispose: () => void;
}

/**
 * Música de fondo: reproduce `marriedlife.mp3` en bucle con fundidos suaves.
 * La reproducción se persiste y solo arranca tras un gesto del usuario
 * (requisito de los navegadores para autoplay con sonido).
 */
export function createPiano(): Piano {
  const audio = new Audio(TRACK_URL);
  audio.loop = true;
  audio.preload = 'metadata';
  audio.volume = 0;

  let playing = false;
  let disposed = false;
  let raf = 0;
  let pauseTimer = 0;
  let onChange: (playing: boolean) => void = () => {};

  function persistedOn(): boolean {
    try {
      return localStorage.getItem(siteConfig.storageKeys.music) === 'on';
    } catch {
      return false;
    }
  }

  function persist(on: boolean): void {
    try {
      localStorage.setItem(siteConfig.storageKeys.music, on ? 'on' : 'off');
    } catch {
      /* almacenamiento no disponible */
    }
  }

  /** Rampa de volumen por rAF para evitar cortes bruscos. */
  function fadeTo(target: number, ms: number): void {
    if (raf) cancelAnimationFrame(raf);
    const from = audio.volume;
    const start = performance.now();
    const step = (): void => {
      const t = Math.min(1, (performance.now() - start) / ms);
      audio.volume = Math.min(1, Math.max(0, from + (target - from) * t));
      raf = t < 1 ? requestAnimationFrame(step) : 0;
    };
    raf = requestAnimationFrame(step);
  }

  function start(): void {
    if (disposed || playing) return;
    playing = true;
    window.clearTimeout(pauseTimer);
    pauseTimer = 0;
    audio.volume = 0;
    void audio
      .play()
      .then(() => {
        if (playing) fadeTo(VOLUME, FADE_MS);
      })
      .catch(() => {
        // Autoplay bloqueado: revertimos el estado para no mentir en la UI.
        playing = false;
        persist(false);
        onChange(false);
      });
    persist(true);
    onChange(true);
  }

  function stop(): void {
    if (!playing) return;
    playing = false;
    fadeTo(0, FADE_MS * 0.6);
    window.clearTimeout(pauseTimer);
    pauseTimer = window.setTimeout(() => {
      if (!playing) audio.pause();
    }, FADE_MS * 0.6 + 60);
    persist(false);
    onChange(false);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && playing) audio.pause();
    else if (!document.hidden && playing) void audio.play().catch(() => {});
  });

  if (persistedOn()) {
    const arm = (): void => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
      if (persistedOn()) start();
    };
    window.addEventListener('pointerdown', arm, { passive: true });
    window.addEventListener('keydown', arm);
  }

  return {
    isPlaying: () => playing,
    toggle(): boolean {
      if (playing) stop();
      else start();
      return playing;
    },
    setOnChange(fn): void {
      onChange = fn;
    },
    dispose(): void {
      disposed = true;
      window.clearTimeout(pauseTimer);
      if (raf) cancelAnimationFrame(raf);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    },
  };
}
