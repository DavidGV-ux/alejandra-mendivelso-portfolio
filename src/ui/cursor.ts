import { el } from '@/utils/dom';
import type { UIComponent } from '@/types/ui';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ARROW_PATH = 'M2 2L19 15L11 16.5L7 24L2 2Z';

export type CursorVariant = 'client' | 'owner';

export interface CursorVisual {
  el: HTMLElement;
  label: HTMLElement;
}

/** Flecha + etiqueta compartida por los cursores y la pantalla de carga. */
export function createCursorVisual(variant: CursorVariant, labelText: string): CursorVisual {
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
    class: `cursor cursor--${variant}`,
    attrs: { 'aria-hidden': 'true' },
  });
  root.append(arrow, label);

  return { el: root, label };
}

/** Coloca el cursor y voltea la etiqueta si se sale por la derecha o abajo. */
export function placeCursor(visual: CursorVisual, x: number, y: number): void {
  visual.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  visual.el.classList.toggle(
    'label-left',
    x + visual.label.offsetWidth + 24 > window.innerWidth,
  );
  visual.el.classList.toggle(
    'label-above',
    y + visual.label.offsetHeight + 30 > window.innerHeight,
  );
}

export interface Cursor extends UIComponent {
  setInteractive: (interactive: boolean) => void;
  setVisible: (visible: boolean) => void;
}

/** Cursor del visitante: sigue al puntero. */
export function createCursor(enabled: boolean, labelText: string): Cursor {
  const visual = createCursorVisual('client', labelText);
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

export interface OwnerCursor extends UIComponent {
  sync: () => void;
}

/**
 * Cursor decorativo de Alejandra: se pasea solo por la escena.
 * No es una conexión en vivo.
 */
export function createOwnerCursor(labelText: string, isEnabled: () => boolean): OwnerCursor {
  const visual = createCursorVisual('owner', labelText);
  const { el: cursor } = visual;
  const desktopPointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let frame: number | null = null;
  let start: number | null = null;
  let pageActive = document.hasFocus();
  let active = false;

  function animate(time: number): void {
    frame = null;
    if (!active) return;
    if (start === null) start = time;

    const elapsed = (time - start) / 1000;
    const top = 96;
    const bottom = window.innerHeight - 128;
    const left = 64;
    const right = window.innerWidth - 168;

    if (bottom - top > 90 && right - left > 120) {
      const centerX = left + (right - left) * 0.58;
      const centerY = (top + bottom) / 2;
      const amplitudeX = Math.min((right - left) * 0.34, 190);
      const amplitudeY = Math.min((bottom - top) * 0.28, 80);

      const rawX =
        centerX + Math.sin(elapsed * 0.52) * amplitudeX + Math.sin(elapsed * 1.13) * 16;
      const rawY =
        centerY + Math.sin(elapsed * 0.71 + 1.2) * amplitudeY + Math.cos(elapsed * 1.07) * 10;

      const x = Math.max(left, Math.min(right, rawX));
      const y = Math.max(top, Math.min(bottom, rawY));

      placeCursor(visual, x, y);
      cursor.classList.add('is-visible');
    } else {
      cursor.classList.remove('is-visible');
    }

    frame = requestAnimationFrame(animate);
  }

  function stop(): void {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    start = null;
    cursor.classList.remove('is-visible');
  }

  function sync(): void {
    active =
      isEnabled() &&
      desktopPointer.matches &&
      !reducedMotion.matches &&
      !document.hidden &&
      pageActive;

    if (active) {
      if (frame === null) frame = requestAnimationFrame(animate);
    } else {
      stop();
    }
  }

  window.addEventListener('blur', () => {
    pageActive = false;
    sync();
  });

  window.addEventListener('focus', () => {
    pageActive = true;
    sync();
  });

  document.addEventListener('visibilitychange', () => {
    pageActive = document.hasFocus();
    sync();
  });

  desktopPointer.addEventListener('change', sync);
  reducedMotion.addEventListener('change', sync);

  return {
    el: cursor,
    sync,
    dispose(): void {
      stop();
      cursor.remove();
    },
  };
}
