type UpdateFn = (dt: number, elapsed: number) => void;
type SettledFn = () => boolean;

export interface LoopDebug {
  renders: number;
  dirty: number;
  topReasons: Array<{ reason: string; count: number }>;
}

export interface Loop {
  start: () => void;
  stop: () => void;
  setRunning: (running: boolean) => void;
  isRunning: () => boolean;
  invalidate: (reason?: string) => void;
  dispose: () => void;
  getDebug: () => LoopDebug;
}

export function createLoop(update: UpdateFn, isSettled?: SettledFn): Loop {
  let rafId = 0;
  let last = 0;
  let elapsed = 0;
  let running = false;
  let dirty = 0;
  let renders = 0;
  const reasons = new Map<string, number>();
  let reasonSnapshot = new Map<string, number>();
  let lastSnapshotSecond = Math.floor(performance.now() / 1000);

  function noteInvalidate(reason?: string): void {
    const r = reason || 'unknown';
    reasons.set(r, (reasons.get(r) ?? 0) + 1);
    dirty = Math.max(dirty, 2);
  }

  function frame(now: number): void {
    rafId = 0;
    if (!running) return;
    const t = now / 1000;
    const dt = last === 0 ? 0 : Math.min(t - last, 0.1);
    last = t;
    elapsed += dt;
    const second = Math.floor(now / 1000);
    if (second !== lastSnapshotSecond) {
      lastSnapshotSecond = second;
      reasonSnapshot = new Map(reasons);
      reasons.clear();
    }
    renders++;
    update(dt, elapsed);
    dirty = Math.max(0, dirty - 1);
    if (isSettled?.() && dirty === 0) {
      rafId = 0;
      return;
    }
    rafId = requestAnimationFrame(frame);
  }

  const wake = (): void => {
    if (!running || rafId) return;
    rafId = requestAnimationFrame(frame);
  };

  return {
    start(): void {
      if (running) return;
      running = true;
      last = 0;
      dirty = 2;
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
    invalidate(reason?: string): void {
      noteInvalidate(reason);
      wake();
    },
    dispose(): void {
      this.stop();
    },
    getDebug(): LoopDebug {
      const topReasons = [...reasonSnapshot.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([reason, count]) => ({ reason, count }));
      return { renders, dirty, topReasons };
    },
  };
}