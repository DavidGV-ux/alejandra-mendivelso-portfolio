type UpdateFn = (dt: number, elapsed: number) => void;

export interface Loop {
  start: () => void;
  stop: () => void;
  /** Pausa/reanuda según visibilidad sin destruir el loop */
  setRunning: (running: boolean) => void;
  isRunning: () => boolean;
  dispose: () => void;
}

export function createLoop(update: UpdateFn): Loop {
  let rafId = 0;
  let last = 0;
  let elapsed = 0;
  let running = false;

  const frame = (now: number): void => {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    const t = now / 1000;
    const dt = last === 0 ? 0 : Math.min(t - last, 0.1);
    last = t;
    elapsed += dt;
    update(dt, elapsed);
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
    },
    setRunning(next: boolean): void {
      if (next) this.start();
      else this.stop();
    },
    isRunning(): boolean {
      return running;
    },
    dispose(): void {
      this.stop();
    },
  };
}
