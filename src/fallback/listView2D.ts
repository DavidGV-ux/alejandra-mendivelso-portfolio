import { el } from '@/utils/dom';
import { joinTools } from '@/utils/format';
import type { UIContext, UIComponent } from '@/types/ui';

export function createFallbackList(ctx: UIContext): UIComponent {
  const { dict, projects } = ctx;

  const list = el('div', { class: 'fallback__grid' });

  projects.forEach((project) => {
    const card = el('article', { class: 'fallback__card', attrs: { id: `project-${project.id}` } });

    card.append(
      el('img', {
        class: 'fallback__cover',
        attrs: {
          src: project.cover,
          alt: project.title,
          loading: 'lazy',
          decoding: 'async',
          width: '1600',
          height: '1100',
        },
      }),
      el('div', {
        class: 'fallback__body',
        children: [
          el('p', { class: 'fallback__meta', text: `${project.category} / ${project.year}` }),
          el('h3', { class: 'fallback__title', text: project.title }),
          el('p', { class: 'fallback__desc', text: project.description }),
          el('p', { class: 'fallback__tools', text: joinTools(project.tools) }),
        ],
      }),
    );

    if (project.links.length > 0) {
      const links = el('ul', { class: 'fallback__links' });
      project.links.forEach((link) => {
        links.append(
          el('li', {
            children: [
              el('a', {
                class: 'link',
                text: link.label,
                attrs: { href: link.url, target: '_blank', rel: 'noopener noreferrer' },
              }),
            ],
          }),
        );
      });
      card.append(links);
    }

    list.append(card);
  });

  const inner = el('div', { class: 'fallback__inner' });
  inner.append(
    el('h2', { class: 'panel__title', text: dict.fallback.title }),
    el('p', { class: 'panel__intro', text: dict.fallback.note }),
    list,
  );

  const root = el('section', {
    class: 'fallback',
    attrs: { 'aria-label': dict.fallback.title },
  });
  root.append(inner);
  root.hidden = true;

  return { el: root };
}
