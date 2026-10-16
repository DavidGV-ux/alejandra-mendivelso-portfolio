import { siteConfig } from '@/config/site.config';

/** Frecuencia de una nota MIDI. */
const freq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

const CHORDS: number[][] = [
  [57, 60, 64, 67], // Am7
  [53, 57, 60, 64], // Fmaj7
  [48, 52, 55, 59], // Cmaj7
  [55, 59, 62, 64], // G6
];

const BPM = 72;
const BEAT = 60 / BPM;
const LOOKAHEAD = 1.2;
const TICK_MS = 400;
const MASTER_LEVEL = 0.16;

export interface Piano {
  isPlaying: () => boolean;
  /** Devuelve el estado resultante. */
  toggle: () => boolean;
  setOnChange: (fn: (playing: boolean) => void) => void;
  dispose: () => void;
}

/**
 * Piano generativo: arpegios suaves sobre una progresión fija, sintetizados
 * con WebAudio (parciales triangular+seno, decay exponencial y un delay corto).
 * La reproducción se persiste y solo arranca tras un gesto del usuario.
 */
export function createPiano(): Piano {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let bus: GainNode | null = null;
  let timer = 0;
  let playing = false;
  let disposed = false;
  let onChange: (playing: boolean) => void = () => {};

  let nextTime = 0;
  let chordIndex = 0;
  let beatInChord = 0;

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

  function ensureGraph(): AudioContext {
    if (ctx) return ctx;
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    ctx = new AudioCtor!();

    master = ctx.createGain();
    master.gain.value = 0;

    bus = ctx.createGain();
    bus.gain.value = 1;

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3200;
    tone.Q.value = 0.4;

    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.31;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.16;

    bus.connect(tone);
    tone.connect(master);
    tone.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);
    master.connect(ctx.destination);

    return ctx;
  }

  /** Voz de piano: triángulo + seno (octava) con envolvente percusiva. */
  function note(midi: number, time: number, velocity: number, duration = 1.9): void {
    if (!ctx || !bus) return;
    const f = freq(midi);

    const voice = ctx.createGain();
    voice.gain.setValueAtTime(0, time);
    voice.gain.linearRampToValueAtTime(velocity, time + 0.008);
    voice.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.value = f;

    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = f * 2;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.32;

    body.connect(voice);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(voice);

    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 2400 + Math.random() * 900;
    voice.connect(soften);
    soften.connect(bus);

    body.start(time);
    shimmer.start(time);
    body.stop(time + duration + 0.05);
    shimmer.stop(time + duration + 0.05);
  }

  function scheduleStep(time: number): void {
    const chord = CHORDS[chordIndex % CHORDS.length]!;
    const jitter = (Math.random() - 0.5) * 0.012;
    const at = Math.max(time + jitter, (ctx?.currentTime ?? 0) + 0.02);

    if (beatInChord === 0) {
      note(chord[0]! - 12, at, 0.4, 2.6);
      note(chord[1]!, at, 0.3);
    } else if (beatInChord === 1) {
      note(chord[2]!, at, 0.26);
    } else if (beatInChord === 2) {
      note(chord[3]!, at, 0.24);
    } else {
      note(chord[2]!, at, 0.22);
      if (Math.random() < 0.3) note(chord[0]! + 12, at + BEAT * 0.5, 0.1, 1.4);
    }

    beatInChord += 1;
    if (beatInChord >= 4) {
      beatInChord = 0;
      chordIndex += 1;
    }
  }

  function tick(): void {
    if (!ctx || !playing) return;
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(nextTime);
      nextTime += BEAT;
    }
  }

  function start(): void {
    if (disposed || playing) return;
    const audio = ensureGraph();
    void audio.resume();
    playing = true;
    nextTime = audio.currentTime + 0.12;
    timer = window.setInterval(tick, TICK_MS);
    tick();
    master!.gain.cancelScheduledValues(audio.currentTime);
    master!.gain.setValueAtTime(master!.gain.value, audio.currentTime);
    master!.gain.linearRampToValueAtTime(MASTER_LEVEL, audio.currentTime + 0.6);
    persist(true);
    onChange(true);
  }

  function stop(): void {
    if (!playing) return;
    playing = false;
    window.clearInterval(timer);
    timer = 0;
    persist(false);
    if (ctx && master) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 0.4);
      window.setTimeout(() => {
        if (!playing && ctx && ctx.state === 'running') void ctx.suspend();
      }, 500);
    }
    onChange(false);
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden && playing) void ctx.suspend();
    else if (!document.hidden && playing) void ctx.resume();
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
      stop();
      window.clearInterval(timer);
      void ctx?.close();
      ctx = null;
      master = null;
      bus = null;
    },
  };
}
