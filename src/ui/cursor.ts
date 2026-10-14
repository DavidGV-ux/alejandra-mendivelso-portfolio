import { el } from '@/utils/dom';
import type { UIComponent } from '@/types/ui';

export interface Cursor extends UIComponent {
  setInteractive: (interactive: boolean) => void;
  setVisible: (visible: boolean) => void;
}

export function createCursor(enabled: boolean): Cursor {
  const dot = el('div', { class: 'cursor__dot' });
  const ring = el('div', { class: 'cursor__ring' });
  const cursor = el('div', { class: 'cursor', attrs: { 'aria-hidden': 'true' } });
  cursor.append(ring, dot);

  let interactive = false;
  let visible = false;
  let x = 0;
  let y = 0;
  let raf = 0;

  function render(): void {
    raf = 0;
    cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function schedule(): void {
    if (raf) return;
    raf = requestAnimationFrame(render);
  }

  if (enabled) {
    window.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse') return;
      x = event.clientX;
      y = event.clientY;
      schedule();
    });
  }

  return {
    el: cursor,
    setInteractive(next: boolean): void {
      if (next === interactive) return;
      interactive = next;
      cursor.classList.toggle('is-interactive', next);
    },
    setVisible(next: boolean): void {
      if (next === visible) return;
      visible = next;
      cursor.classList.toggle('is-visible', next);
    },
    dispose(): void {
      if (raf) cancelAnimationFrame(raf);
      cursor.remove();
    },
  };
}
