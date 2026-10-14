import { el } from '@/utils/dom';
import type { Dictionary } from '@/config/i18n';
import type { UIComponent } from '@/types/ui';

export interface LoadingScreen extends UIComponent {
  setProgress: (value: number) => void;
  hide: () => void;
  showSlow: () => void;
}

export function createLoadingScreen(dict: Dictionary): LoadingScreen {
  const bar = el('div', { class: 'loader__bar' });
  const fill = el('div', { class: 'loader__fill' });
  bar.append(fill);

  const label = el('span', { class: 'loader__label', text: dict.loader.loading });
  const value = el('span', { class: 'loader__value', text: '0%' });
  const note = el('p', { class: 'loader__note', attrs: { hidden: 'true' }, text: dict.loader.slow });

  const panel = el('div', { class: 'loader__panel' });
  panel.append(
    el('div', { class: 'loader__top', children: [label, value] }),
    bar,
    note,
  );

  const root = el('div', {
    class: 'loader',
    attrs: { role: 'status', 'aria-live': 'polite', 'aria-label': dict.loader.loading },
  });
  root.append(panel);

  let lastValue = -1;

  function setProgress(next: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(next)));
    if (clamped === lastValue) return;
    lastValue = clamped;
    fill.style.transform = `scaleX(${clamped / 100})`;
    value.textContent = `${clamped}%`;
  }

  return {
    el: root,
    setProgress,
    showSlow(): void {
      note.removeAttribute('hidden');
    },
    hide(): void {
      root.classList.add('is-done');
      window.setTimeout(() => root.setAttribute('hidden', 'true'), 700);
    },
    dispose(): void {
      root.remove();
    },
  };
}
