import { on } from '@/utils/dom';
import type { FrameHandle } from '@/scene/frame';

interface HoverOptions {
  pick: (clientX: number, clientY: number) => FrameHandle | null;
  onEnter: (frame: FrameHandle) => void;
  onLeave: (frame: FrameHandle) => void;
  /** Si devuelve false, el hover se ignora (p. ej. durante un arrastre o detalle). */
  isEnabled: () => boolean;
}

export function attachHover(target: HTMLElement, options: HoverOptions): () => void {
  let current: FrameHandle | null = null;
  let x = 0;
  let y = 0;
  let dirty = false;
  let raf = 0;

  const evaluate = (): void => {
    raf = 0;
    if (dirty) return;
    dirty = true;
    if (!options.isEnabled()) {
      if (current) {
        options.onLeave(current);
        current = null;
      }
      dirty = false;
      return;
    }
    const frame = options.pick(x, y);
    if (frame !== current) {
      if (current) options.onLeave(current);
      if (frame) options.onEnter(frame);
      current = frame;
    }
    dirty = false;
  };

  const schedule = (): void => {
    if (raf) return;
    raf = requestAnimationFrame(evaluate);
  };

  const move = (event: PointerEvent): void => {
    x = event.clientX;
    y = event.clientY;
    schedule();
  };

  const leave = (): void => {
    if (current) {
      options.onLeave(current);
      current = null;
    }
  };

  const disposers = [on(target, 'pointermove', move), on(target, 'pointerleave', leave)];

  return () => {
    leave();
    if (raf) cancelAnimationFrame(raf);
    disposers.forEach((d) => d());
  };
}
