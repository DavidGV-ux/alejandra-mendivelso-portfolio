type UpdateFn = (dt: number, elapsed: number) => void;
type SettledFn = () => boolean;

export interface Loop {
  start: () => void;
  stop: () => void;
  /** Pausa/reanuda según visibilidad sin destruir el loop */
  setRunning: (running: boolean) => void;
  isRunning: () => boolean;
  /** Despierta el loop cuando el estado deja de estar en reposo. */
  invalidate: () => void;
  dispose: () => void;
}

/**
 * Loop con render bajo demanda: mientras `isSettled` devuelva true, no se
 * programa un nuevo frame. Cualquier cambio de estado debe llamar a
 * `invalidate()` para despertarlo.
 */
export function createLoop(update: UpdateFn, isSettled?: SettledFn): Loop {
  let rafId = 0;
  let last = 0;
  let elapsed = 0;
  let running = false;

  const frame = (now: number): void => {
    rafId = 0;
    if (!running) return;
    const t = now / 1000;
    const dt = last === 0 ? 0 : Math.min(t - last, 0.1);
    last = t;
    elapsed += dt;
    update(dt, elapsed);
    if (isSettled?.()) return;
    rafId = requestAnimationFrame(frame);
  };

  const wake = (): void => {
    if (!running || rafId) return;
    rafId = requestAnimationFrame(frame);
  };

  return {
    start(): void {
      if (running) return;
      running = true;
      last = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop(): void {
      running = false;
      cancelAnimationFrame(rafId);
      rafId = 0;
    },
    setRunning(next: boolean): void {
      if (next) this.start();
      else this.stop();
    },
    isRunning(): boolean {
      return running;
    },
    invalidate(): void {
      wake();
    },
    dispose(): void {
      this.stop();
    },
  };
}
