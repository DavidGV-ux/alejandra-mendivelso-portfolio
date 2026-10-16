import { el, on } from '@/utils/dom';
import { closeSvg } from './icons';
import type { UIContext, UIComponent } from '@/types/ui';

export interface IntroTip extends UIComponent {
  show: () => void;
  hide: () => void;
  isVisible: () => boolean;
}

const AUTO_HIDE_MS = 9000;
const LEAVE_MS = 380;

/**
 * Aviso ligero que se abre al empezar a explorar el pasillo: recuerda cómo
 * moverse y que cada proyecto se abre con doble clic. No bloquea la
 * interacción con la escena y se cierra solo.
 */
export function createIntroTip(ctx: UIContext): IntroTip {
  const { dict } = ctx;
  const t = dict.tip;

  const items = el('ul', { class: 'tip__list' });
  t.items.forEach((item) => items.append(el('li', { class: 'tip__item', text: item })));

  const closeBtn = el('button', {
    class: 'tip__close',
    html: closeSvg(15),
    attrs: { type: 'button', 'aria-label': dict.nav.close },
  });

  const root = el('aside', {
    class: 'tip',
    attrs: { role: 'status', 'aria-live': 'polite' },
  });
  root.append(el('p', { class: 'tip__title', text: t.title }), items, closeBtn);
  root.hidden = true;

  let autoHide = 0;
  let leaving = 0;

  function hide(): void {
    if (root.hidden) return;
    window.clearTimeout(autoHide);
    window.clearTimeout(leaving);
    root.classList.remove('is-visible');
    leaving = window.setTimeout(() => {
      root.hidden = true;
    }, LEAVE_MS);
  }

  function show(): void {
    if (!root.hidden) return;
    window.clearTimeout(leaving);
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add('is-visible'));
    window.clearTimeout(autoHide);
    autoHide = window.setTimeout(hide, AUTO_HIDE_MS);
  }

  const disposers = [on(closeBtn, 'click', hide)];

  return {
    el: root,
    show,
    hide,
    isVisible: () => !root.hidden,
    dispose: () => {
      window.clearTimeout(autoHide);
      window.clearTimeout(leaving);
      disposers.forEach((d) => d());
    },
  };
}
