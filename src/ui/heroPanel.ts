import { el, on } from '@/utils/dom';
import type { UIContext, UIComponent } from '@/types/ui';

export interface HeroPanel extends UIComponent {
  show: () => void;
  hide: () => void;
  isVisible: () => boolean;
}

/**
 * Portada del portafolio: aparece al terminar la intro (o de inmediato en el
 * modo lista) y presenta la propuesta con accesos directos a proyectos,
 * hoja de vida y contacto.
 */
export function createHeroPanel(ctx: UIContext): HeroPanel {
  const { dict, actions } = ctx;
  const t = dict.hero;

  const exploreBtn = el('button', {
    class: 'btn btn--primary',
    text: t.explore,
    attrs: { type: 'button' },
  });
  const cvBtn = el('button', { class: 'btn', text: t.cv, attrs: { type: 'button' } });
  const contactBtn = el('button', { class: 'btn', text: t.contact, attrs: { type: 'button' } });

  const actionsRow = el('div', { class: 'hero__actions' });
  actionsRow.append(exploreBtn, cvBtn, contactBtn);

  const card = el('article', { class: 'hero__card' });
  card.append(
    el('p', { class: 'hero__label', text: t.label }),
    el('h2', { class: 'hero__title', id: 'hero-title', text: t.title }),
    el('p', { class: 'hero__lead', text: t.lead }),
    el('p', { class: 'hero__where', text: t.where }),
    actionsRow,
  );

  const root = el('section', {
    class: 'hero',
    attrs: { 'aria-labelledby': 'hero-title' },
  });
  root.append(card);
  root.hidden = true;

  const disposers = [
    on(exploreBtn, 'click', () => actions.dismissHero()),
    on(cvBtn, 'click', () => actions.openCv()),
    on(contactBtn, 'click', () => {
      actions.dismissHero();
      actions.goToSection('contact');
    }),
  ];

  return {
    el: root,
    show: () => {
      root.hidden = false;
      requestAnimationFrame(() => root.classList.add('is-visible'));
    },
    hide: () => {
      root.classList.remove('is-visible');
      root.hidden = true;
    },
    isVisible: () => !root.hidden,
    dispose: () => disposers.forEach((d) => d()),
  };
}
