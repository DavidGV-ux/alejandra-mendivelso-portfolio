import { on } from '@/utils/dom';

interface WheelOptions {
  onWheel: (delta: number) => void;
  /** ms mínimos entre eventos para evitar saltos en trackpads */
  cooldown?: number;
}

export function attachWheel(target: HTMLElement, options: WheelOptions): () => void {
  const cooldown = options.cooldown ?? 260;
  let last = 0;

  const handler = (event: WheelEvent): void => {
    const now = performance.now();
    const dominant = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(dominant) < 4) return;
    if (now - last < cooldown) return;
    last = now;
    options.onWheel(Math.sign(dominant));
  };

  return on(target, 'wheel', handler, { passive: true });
}
