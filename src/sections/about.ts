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
        width: '720',
        height: '720',
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
  card.append(
    el('p', { class: 'card__tagline', text: profile.tagline }),
    el('p', { class: 'card__bio', text: profile.bio }),
  );
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
    list.append(
      el('li', { class: 'timeline__item' }, {
        children: [
          el('span', { class: 'timeline__period', text: item.period }),
          el('div', { class: 'timeline__body' }, {
            children: [
              el('h4', { class: 'timeline__title', text: item.title }),
              el('p', { class: 'timeline__org', text: item.org }),
              item.description
                ? el('p', { class: 'timeline__desc', text: item.description })
                : el('span'),
            ],
          }),
        ],
      }),
    );
  }
  return el('article', { class: 'card card--experience' }, {
    children: [el('h3', { class: 'card__title', text: title }), list],
  });
}

function buildSkillsCard(profile: Profile, title: string): HTMLElement {
  const list = el('ul', { class: 'skills' });
  for (const skill of profile.skills) {
    const level = skill.level ?? 0;
    list.append(
      el('li', { class: 'skill' }, {
        children: [
          el('div', { class: 'skill__head' }, {
            children: [
              el('span', { class: 'skill__name', text: skill.name }),
              skill.level !== undefined
                ? el('span', { class: 'skill__level', text: `${level}` })
                : el('span'),
            ],
          }),
          skill.level !== undefined
            ? el('div', { class: 'skill__track', children: [el('div', { class: 'skill__fill', style: { width: `${level}%` } })] })
            : el('span'),
        ],
      }),
    );
  }
  return el('article', { class: 'card card--skills' }, {
    children: [el('h3', { class: 'card__title', text: title }), list],
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
      return buildSkillsCard(profile, card.title ?? fallbackTitle);
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

  const inner = el('div', { class: 'panel__inner' });
  inner.append(
    el('p', { class: 'panel__kicker', text: profile.location }),
    el('h2', { class: 'panel__title', id: 'about-title', text: dict.about.title }),
    grid,
  );

  const panel = el('section', {
    class: 'panel panel--about',
    attrs: { 'aria-labelledby': 'about-title', tabindex: '-1' },
  });
  panel.append(inner);
  panel.hidden = true;

  return {
    el: panel,
    show: () => {
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
