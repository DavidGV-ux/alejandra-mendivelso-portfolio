import { on } from '@/utils/dom';

interface DragOptions {
  onDragStart?: () => void;
  /** Desplazamiento acumulado en px desde el origen del gesto. */
  onDrag: (deltaX: number, deltaY: number) => void;
  onDragEnd: (deltaX: number, velocityX: number) => void;
  onTap: (event: PointerEvent) => void;
  /** Umbral en px para considerar un gesto como arrastre. */
  threshold?: number;
}

export function attachDrag(target: HTMLElement, options: DragOptions): () => void {
  const threshold = options.threshold ?? 8;
  let active = false;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocityX = 0;

  const down = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (active) {
      // Un segundo puntero cede el gesto al pellizco: se cancela el arrastre.
      cancel();
      return;
    }
    active = true;
    dragging = false;
    startX = event.clientX;
    startY = event.clientY;
    lastX = event.clientX;
    lastTime = performance.now();
    velocityX = 0;
  };

  const move = (event: PointerEvent): void => {
    if (!active) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (!dragging && Math.hypot(dx, dy) > threshold) {
      dragging = true;
      options.onDragStart?.();
      target.setPointerCapture?.(event.pointerId);
    }

    if (dragging) {
      const now = performance.now();
      const dt = Math.max(now - lastTime, 1);
      velocityX = (event.clientX - lastX) / dt;
      lastX = event.clientX;
      lastTime = now;
      options.onDrag(dx, dy);
    }
  };

  const up = (event: PointerEvent): void => {
    if (!active) return;
    active = false;
    target.releasePointerCapture?.(event.pointerId);
    if (dragging) {
      dragging = false;
      options.onDragEnd(event.clientX - startX, velocityX);
    } else {
      options.onTap(event);
    }
  };

  const cancel = (): void => {
    if (!active) return;
    active = false;
    if (dragging) {
      dragging = false;
      options.onDragEnd(0, 0);
    }
  };

  const disposers = [
    on(target, 'pointerdown', down),
    on(target, 'pointermove', move),
    on(target, 'pointerup', up),
    on(target, 'pointercancel', cancel),
  ];

  return () => disposers.forEach((d) => d());
}
