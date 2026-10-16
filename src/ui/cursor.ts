import { el } from '@/utils/dom';
import type { UIComponent } from '@/types/ui';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ARROW_PATH = 'M2 2L19 15L11 16.5L7 24L2 2Z';

export interface CursorVisual {
  el: HTMLElement;
  label: HTMLElement;
  /** Caché de tamaño de la etiqueta; se invalida al redimensionar. */
  labelSize: { width: number; height: number } | null;
}

/** Flecha + etiqueta del cursor del visitante. */
export function createCursorVisual(labelText: string): CursorVisual {
  const arrow = document.createElementNS(SVG_NS, 'svg');
  arrow.setAttribute('class', 'cursor__arrow');
  arrow.setAttribute('viewBox', '0 0 22 26');
  arrow.setAttribute('fill', 'none');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.setAttribute('focusable', 'false');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ARROW_PATH);
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('stroke', 'white');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linejoin', 'round');
  arrow.append(path);

  const label = el('div', { class: 'cursor__label', text: labelText });

  const root = el('div', {
    class: 'cursor',
    attrs: { 'aria-hidden': 'true' },
  });
  root.append(arrow, label);

  const visual: CursorVisual = { el: root, label, labelSize: null };
  window.addEventListener('resize', () => (visual.labelSize = null), { passive: true });
  return visual;
}

/** Coloca el cursor y voltea la etiqueta si se sale por la derecha o abajo. */
export function placeCursor(visual: CursorVisual, x: number, y: number): void {
  visual.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  if (!visual.labelSize) {
    visual.labelSize = { width: visual.label.offsetWidth, height: visual.label.offsetHeight };
  }
  visual.el.classList.toggle(
    'label-left',
    x + visual.labelSize.width + 24 > window.innerWidth,
  );
  visual.el.classList.toggle(
    'label-above',
    y + visual.labelSize.height + 30 > window.innerHeight,
  );
}

export interface Cursor extends UIComponent {
  setInteractive: (interactive: boolean) => void;
  setVisible: (visible: boolean) => void;
}

/** Cursor del visitante: sigue al puntero. */
export function createCursor(enabled: boolean, labelText: string): Cursor {
  const visual = createCursorVisual(labelText);
  const { el: cursor } = visual;

  let interactive = false;
  let visible = false;
  let x = 0;
  let y = 0;
  let raf = 0;

  function render(): void {
    raf = 0;
    placeCursor(visual, x, y);
  }

  function schedule(): void {
    if (raf) return;
    raf = requestAnimationFrame(render);
  }

  function show(next: boolean): void {
    if (next === visible) return;
    visible = next;
    cursor.classList.toggle('is-visible', next);
    document.documentElement.classList.toggle('has-custom-cursor', next);
  }

  if (enabled) {
    window.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'mouse' || document.hidden) {
          show(false);
          return;
        }
        x = event.clientX;
        y = event.clientY;
        schedule();
        show(true);
      },
      { passive: true },
    );

    document.documentElement.addEventListener('pointerleave', () => show(false));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) show(false);
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
      show(next);
    },
    dispose(): void {
      if (raf) cancelAnimationFrame(raf);
      cursor.remove();
      document.documentElement.classList.remove('has-custom-cursor');
    },
  };
}
