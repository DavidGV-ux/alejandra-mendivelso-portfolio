import { el } from '@/utils/dom';
import { createCursorVisual, placeCursor } from '@/ui/cursor';
import { siteConfig } from '@/config/site.config';
import type { Dictionary } from '@/config/i18n';
import type { Profile } from '@/types/profile';
import type { UIComponent } from '@/types/ui';

const SVG_NS = 'http://www.w3.org/2000/svg';

const START_DELAY = 400;
const DRAW_DURATION = 1400;
const HOLD_DURATION = 700;
const FADE_DURATION = 700;
const STROKE_LENGTH = 2240;

export interface LoadingScreen extends UIComponent {
  setProgress: (value: number) => void;
  hide: (onHidden?: () => void) => void;
  showSlow: () => void;
}

function pointOnRect(progress: number, rect: DOMRect): { x: number; y: number } {
  const w = rect.width;
  const h = rect.height;
  const perimeter = 2 * (w + h);
  let d = progress * perimeter;

  if (d <= w) return { x: rect.left + d, y: rect.top };
  d -= w;

  if (d <= h) return { x: rect.right, y: rect.top + d };
  d -= h;

  if (d <= w) return { x: rect.right - d, y: rect.bottom };
  d -= w;

  return { x: rect.left, y: rect.bottom - d };
}

export function createLoadingScreen(dict: Dictionary, profile: Profile): LoadingScreen {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'loader__stroke');
  svg.setAttribute('viewBox', '0 0 760 360');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', '1');
  rect.setAttribute('y', '1');
  rect.setAttribute('width', '758');
  rect.setAttribute('height', '358');
  rect.setAttribute('rx', '6');
  rect.setAttribute('ry', '6');
  svg.append(rect);

  const inner = el('div', { class: 'loader__inner' });
  inner.append(
    el('h1', { class: 'loader__name', text: siteConfig.name }),
    el('p', { class: 'loader__role', text: profile.role }),
  );

  const box = el('div', { class: 'loader__box' });
  box.append(svg, inner);

  const fill = el('div', { class: 'loader__fill' });
  const bar = el('div', { class: 'loader__bar' });
  bar.append(fill);
  const value = el('span', { class: 'loader__value', text: '0%' });
  const progress = el('div', { class: 'loader__progress' });
  progress.append(bar, value);

  const note = el('p', {
    class: 'loader__note',
    attrs: { hidden: 'true' },
    text: dict.loader.slow,
  });

  const panel = el('div', { class: 'loader__panel' });
  panel.append(box, progress, note);

  const owner = createCursorVisual('owner', dict.cursor.owner);

  const skip = el('button', { class: 'loader__skip', attrs: { type: 'button' } });
  skip.append(dict.loader.skip, el('span', { text: '↗' }));

  const root = el('div', {
    class: 'loader',
    attrs: { role: 'status', 'aria-live': 'polite', 'aria-label': dict.loader.loading },
  });
  root.append(panel, skip, owner.el);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hiddenCallbacks: Array<() => void> = [];

  let progressValue = 0;
  let holdDone = false;
  let hideRequested = false;
  let skipRequested = false;
  let hiding = false;
  let raf = 0;
  let start: number | null = null;
  let holdTimer = 0;

  function renderProgress(): void {
    fill.style.transform = `scaleX(${progressValue / 100})`;
    value.textContent = `${progressValue}%`;
  }

  function revealText(): void {
    inner.classList.add('is-visible');
  }

  function maybeHide(): void {
    if (hiding || !hideRequested) return;
    if (!holdDone && !skipRequested) return;
    doHide();
  }

  function doHide(): void {
    if (hiding) return;
    hiding = true;

    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.clearTimeout(holdTimer);
    document.removeEventListener('keydown', onKeydown);

    root.classList.add('is-done');
    owner.el.classList.remove('is-visible');

    window.setTimeout(() => {
      root.setAttribute('hidden', 'true');
      hiddenCallbacks.forEach((callback) => callback());
      hiddenCallbacks.length = 0;
    }, FADE_DURATION);
  }

  function drawFrame(time: number): void {
    raf = 0;
    if (start === null) start = time;

    const elapsed = time - start;
    const drawProgress =
      elapsed <= START_DELAY ? 0 : Math.min(1, (elapsed - START_DELAY) / DRAW_DURATION);

    rect.style.strokeDashoffset = String(STROKE_LENGTH * (1 - drawProgress));

    const boxRect = box.getBoundingClientRect();
    const point = pointOnRect(drawProgress, boxRect);
    placeCursor(owner, point.x, point.y);
    owner.el.classList.add('is-visible');

    if (drawProgress >= 0.25) revealText();

    if (drawProgress < 1) {
      raf = requestAnimationFrame(drawFrame);
      return;
    }

    holdTimer = window.setTimeout(() => {
      holdDone = true;
      maybeHide();
    }, HOLD_DURATION);
  }

  function requestSkip(): void {
    if (skipRequested) return;
    skipRequested = true;

    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    window.clearTimeout(holdTimer);

    rect.style.strokeDashoffset = '0';
    owner.el.classList.remove('is-visible');
    revealText();

    holdDone = true;
    maybeHide();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      requestSkip();
    }
  }

  skip.addEventListener('click', requestSkip);
  document.addEventListener('keydown', onKeydown);

  if (reducedMotion) {
    rect.style.strokeDashoffset = '0';
    revealText();
    holdDone = true;
  } else {
    raf = requestAnimationFrame(drawFrame);
  }

  return {
    el: root,
    setProgress(next: number): void {
      const clamped = Math.max(0, Math.min(100, Math.round(next)));
      if (clamped === progressValue) return;
      progressValue = clamped;
      renderProgress();
    },
    hide(onHidden?: () => void): void {
      if (onHidden) hiddenCallbacks.push(onHidden);
      hideRequested = true;
      maybeHide();
    },
    showSlow(): void {
      note.removeAttribute('hidden');
    },
    dispose(): void {
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(holdTimer);
      document.removeEventListener('keydown', onKeydown);
      root.remove();
    },
  };
}
