import { el, on } from '@/utils/dom';
import { closeSvg } from './icons';
import type { UIContext, UIComponent } from '@/types/ui';

export interface HelpCard extends UIComponent {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}

export function createHelpCard(ctx: UIContext, isTouch: boolean): HelpCard {
  const { dict, actions } = ctx;
  let open = false;

  const list = el('ul', { class: 'help__list' });
  const controls = dict.help.controls;
  const items = isTouch
    ? [controls.touch, controls.click, controls.esc]
    : [controls.wheel, controls.drag, controls.keys, controls.click, controls.esc];
  for (const item of items) {
    list.append(el('li', { class: 'help__item', children: [el('span', { class: 'help__dot' }), el('span', { text: item })] }));
  }

  const closeBtn = el('button', {
    class: 'modal__close',
    html: closeSvg(),
    attrs: { type: 'button', 'aria-label': dict.nav.close },
  });

  const card = el('div', {
    class: 'modal__card help',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'help-title' },
  });
  card.append(
    el('div', {
      class: 'modal__head',
      children: [
        el('h2', { class: 'modal__title', id: 'help-title', text: dict.help.title }),
        closeBtn,
      ],
    }),
    el('p', { class: 'modal__intro', text: dict.help.intro }),
    list,
    el('p', { class: 'help__footer', text: dict.help.footer }),
  );

  const gotIt = el('button', {
    class: 'btn btn--primary',
    text: dict.help.gotIt,
    attrs: { type: 'button' },
  });
  card.append(el('div', { class: 'modal__actions', children: [gotIt] }));

  const backdrop = el('div', { class: 'modal', attrs: { role: 'presentation' } });
  backdrop.append(card);
  backdrop.hidden = true;

  function setOpen(next: boolean): void {
    open = next;
    backdrop.hidden = !next;
    document.body.classList.toggle('has-modal', next || ctx.store.get().detailProjectId !== null);
    if (next) {
      gotIt.focus();
    }
  }

  const disposers = [
    on(closeBtn, 'click', () => actions.closeHelp()),
    on(gotIt, 'click', () => actions.closeHelp()),
    on(backdrop, 'click', (event) => {
      if (event.target === backdrop) actions.closeHelp();
    }),
  ];

  return {
    el: backdrop,
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => open,
    dispose: () => disposers.forEach((d) => d()),
  };
}
