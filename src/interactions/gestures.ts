import { on } from '@/utils/dom';

interface GestureOptions {
  /** Cambio de FOV sugerido por el gesto de pellizco (delta acumulado). */
  onPinch: (deltaFov: number) => void;
  onPinchEnd: () => void;
}

function distance(touches: TouchList): number {
  const [a, b] = [touches[0], touches[1]];
  if (!a || !b) return 0;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/** Pellizco de dos dedos para acercar/alejar (ajusta el FOV de la cámara). */
export function attachGestures(target: HTMLElement, options: GestureOptions): () => void {
  let lastDistance = 0;
  let pinching = false;

  const start = (event: TouchEvent): void => {
    if (event.touches.length === 2) {
      pinching = true;
      lastDistance = distance(event.touches);
    }
  };

  const move = (event: TouchEvent): void => {
    if (!pinching || event.touches.length !== 2) return;
    const current = distance(event.touches);
    if (lastDistance === 0) {
      lastDistance = current;
      return;
    }
    const ratio = current / lastDistance;
    lastDistance = current;
    options.onPinch((1 - ratio) * 60);
  };

  const end = (): void => {
    if (!pinching) return;
    pinching = false;
    lastDistance = 0;
    options.onPinchEnd();
  };

  const disposers = [
    on(target, 'touchstart', start, { passive: true }),
    on(target, 'touchmove', move, { passive: true }),
    on(target, 'touchend', end),
    on(target, 'touchcancel', end),
  ];

  return () => disposers.forEach((d) => d());
}
