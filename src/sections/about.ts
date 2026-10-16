import { el } from '@/utils/dom';
import type { AboutCard, Profile } from '@/types/profile';
import type { UIContext, UIComponent } from '@/types/ui';

export interface AboutPanel extends UIComponent {
  show: () => void;
  hide: () => void;
  isVisible: () => boolean;
}

function buildProfileCard(profile: Profile): HTMLElement {
  const card = el('article', { class: 'card card--profile' });
  card.append(
    el('img', {
      class: 'card__photo',
      attrs: {
        src: profile.photo,
        alt: profile.name,
        loading: 'lazy',
        decoding: 'async',
        width: '1024',
        height: '1024',
      },
    }),
    el('div', { class: 'card__identity' }, {
      children: [
        el('h3', { class: 'card__name', text: profile.name }),
        el('p', { class: 'card__role', text: profile.role }),
        el('p', { class: 'card__location', text: profile.location }),
      ],
    }),
  );
  return card;
}

function buildBioCard(profile: Profile): HTMLElement {
  const card = el('article', { class: 'card card--bio' });
  card.append(el('p', { class: 'card__tagline', text: profile.tagline }));
  for (const paragraph of profile.bio.split('\n\n')) {
    card.append(el('p', { class: 'card__bio', text: paragraph }));
  }
  return card;
}

function buildStatsCard(profile: Profile): HTMLElement {
  const grid = el('div', { class: 'stats' });
  for (const stat of profile.stats) {
    grid.append(
      el('div', { class: 'stat' }, {
        children: [
          el('span', { class: 'stat__value', text: stat.value }),
          el('span', { class: 'stat__label', text: stat.label }),
        ],
      }),
    );
  }
  return el('article', { class: 'card card--stats', children: [grid] });
}

function buildExperienceCard(profile: Profile, title: string): HTMLElement {
  const list = el('ol', { class: 'timeline' });
  for (const item of profile.experience) {
    const body = el('div', { class: 'timeline__body' });
    body.append(
      el('h4', { class: 'timeline__title', text: item.title }),
      el('p', { class: 'timeline__org', text: item.org }),
    );
    if (item.description) body.append(el('p', { class: 'timeline__desc', text: item.description }));
    if (item.points.length > 0) {
      const points = el('ul', { class: 'timeline__points' });
      for (const point of item.points) {
        points.append(el('li', { class: 'timeline__point', text: point.text }));
      }
      body.append(points);
    }
    list.append(
      el('li', { class: 'timeline__item' }, {
        children: [el('span', { class: 'timeline__period', text: item.period }), body],
      }),
    );
  }
  return el('article', { class: 'card card--experience' }, {
    children: [el('h3', { class: 'card__title', text: title }), list],
  });
}

function buildSkillsCard(card: AboutCard, profile: Profile, title: string): HTMLElement {
  const content = el('div', { class: 'skills' });
  if (card.body) content.append(el('p', { class: 'skills__intro', text: card.body }));
  for (const group of profile.skills) {
    const items = el('ul', { class: 'skill-group__items' });
    for (const item of group.items) {
      items.append(el('li', { class: 'skill-chip', text: item }));
    }
    content.append(
      el('div', { class: 'skill-group' }, {
        children: [el('h4', { class: 'skill-group__title', text: group.title }), items],
      }),
    );
  }
  return el('article', { class: 'card card--skills' }, {
    children: [el('h3', { class: 'card__title', text: title }), content],
  });
}

function buildTextCard(card: AboutCard): HTMLElement {
  return el('article', { class: 'card card--text' }, {
    children: [
      card.title ? el('h3', { class: 'card__title', text: card.title }) : el('span'),
      el('p', { class: 'card__body', text: card.body ?? '' }),
    ],
  });
}

function buildCard(card: AboutCard, profile: Profile, fallbackTitle: string): HTMLElement {
  switch (card.type) {
    case 'profile':
      return buildProfileCard(profile);
    case 'bio':
      return buildBioCard(profile);
    case 'stats':
      return buildStatsCard(profile);
    case 'experience':
      return buildExperienceCard(profile, card.title ?? fallbackTitle);
    case 'skills':
      return buildSkillsCard(card, profile, card.title ?? fallbackTitle);
    case 'text':
      return buildTextCard(card);
  }
}

export function createAboutPanel(ctx: UIContext): AboutPanel {
  const { dict, profile } = ctx;

  const grid = el('div', { class: 'about-grid' });
  profile.aboutCards.forEach((card, i) => {
    const node = buildCard(card, profile, dict.about.title);
    node.classList.add('card--span-' + (card.span ?? 1));
    node.style.setProperty('--stagger', `${i * 70}ms`);
    grid.append(node);
  });

  const lead = el('p', { class: 'about__lead' });
  lead.append(
    el('span', { text: dict.about.leadStart }),
    el('span', { class: 'about__hl', text: profile.name }),
    el('span', { text: dict.about.leadAfter }),
    el('span', { class: 'about__hl', text: dict.about.leadHl }),
    el('span', { text: dict.about.leadEnd }),
  );

  const hero = el('div', { class: 'about__hero' });
  hero.append(
    el('p', { class: 'about__label', text: dict.about.label }),
    el('h2', { class: 'about__title', id: 'about-title', text: dict.about.headline }),
    lead,
  );

  const inner = el('div', { class: 'panel__inner' });
  inner.append(hero, grid);

  const panel = el('section', {
    class: 'panel panel--about',
    attrs: { 'aria-labelledby': 'about-title', tabindex: '-1' },
  });
  panel.append(inner);
  panel.hidden = true;

  return {
    el: panel,
    show: () => {
      // Clear residual content from previous renders
      grid.innerHTML = '';
      profile.aboutCards.forEach((card, i) => {
        const node = buildCard(card, profile, dict.about.title);
        node.classList.add('card--span-' + (card.span ?? 1));
        node.style.setProperty('--stagger', `${i * 70}ms`);
        grid.append(node);
      });
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add('is-visible'));
    },
    hide: () => {
      panel.classList.remove('is-visible');
      panel.hidden = true;
    },
    isVisible: () => !panel.hidden,
  };
}
