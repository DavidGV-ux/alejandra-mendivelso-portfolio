import { clearElement, el, on } from '@/utils/dom';
import { joinTools } from '@/utils/format';
import { createResponsiveImage } from '@/utils/media';
import { arrowSvg, closeSvg } from './icons';
import type { MediaItem, Project } from '@/types/project';
import type { UIContext, UIComponent } from '@/types/ui';

export interface DetailView extends UIComponent {
  render: (project: Project) => void;
  open: () => boolean;
  close: () => void;
  nextMedia: () => void;
  prevMedia: () => void;
  isOpen: () => boolean;
}

function buildSlide(item: MediaItem, dict: UIContext['dict']): HTMLElement {
  const slide = el('div', { class: 'detail__slide' });

  if (item.kind === 'video') {
    const video = el('video', {
      class: 'detail__video',
      attrs: {
        controls: 'true',
        playsinline: 'true',
        preload: 'metadata',
        poster: item.poster ?? '',
      },
    });
    const source = el('source', { attrs: { src: item.src, type: 'video/mp4' } });
    video.append(source);
    if (item.captions) {
      const track = el('track', {
        attrs: { kind: 'captions', src: item.captions, srclang: 'es', label: 'Español', default: 'true' },
      });
      video.append(track);
    }
    slide.append(video);
  } else if (item.kind === 'glb') {
    slide.append(
      el('div', { class: 'detail__note' }, {
        children: [
          el('span', { class: 'detail__badge', text: '3D' }),
          el('a', {
            class: 'btn',
            text: 'Abrir modelo .glb',
            attrs: { href: item.src, target: '_blank', rel: 'noopener noreferrer' },
          }),
        ],
      }),
    );
  } else {
    const { el: imageEl, img } = createResponsiveImage({
      src: item.src,
      alt: item.alt ?? '',
      sizes: '(max-width: 920px) 92vw, 880px',
      className: 'detail__image',
      width: item.width ?? 1600,
      height: item.height ?? 1100,
    });
    img.addEventListener('error', () => {
      img.classList.add('is-error');
      img.alt = dict.detail.mediaError;
    });
    slide.append(imageEl);
  }

  return slide;
}

export function createDetailView(ctx: UIContext): DetailView {
  const { dict, actions, projects } = ctx;
  let project: Project | null = null;
  let index = 0;

  const stage = el('div', { class: 'detail__stage' });
  const dots = el('div', { class: 'detail__dots' });
  const mediaCounter = el('span', { class: 'detail__mediacounter', attrs: { 'aria-live': 'polite' } });
  const mediaPrev = el('button', {
    class: 'detail__mediabtn detail__mediabtn--prev',
    html: arrowSvg('left'),
    attrs: { type: 'button', 'aria-label': dict.nav.prev },
  });
  const mediaNext = el('button', {
    class: 'detail__mediabtn detail__mediabtn--next',
    html: arrowSvg('right'),
    attrs: { type: 'button', 'aria-label': dict.nav.next },
  });
  stage.append(mediaPrev, mediaNext, mediaCounter, dots);

  const title = el('h2', { class: 'detail__title', id: 'detail-title' });
  const kicker = el('p', { class: 'detail__kicker' });
  const description = el('p', { class: 'detail__desc' });

  const metaRole = el('dd', { class: 'detail__value' });
  const metaTools = el('dd', { class: 'detail__value' });
  const metaYear = el('dd', { class: 'detail__value' });
  const metaClient = el('dd', { class: 'detail__value' });
  const clientRow = el('div', { class: 'detail__metarow' });
  clientRow.append(el('dt', { text: dict.detail.client }), metaClient);

  const linksList = el('ul', { class: 'detail__links' });

  const meta = el('dl', { class: 'detail__meta' });
  meta.append(
    el('div', { class: 'detail__metarow', children: [el('dt', { text: dict.detail.role }), metaRole] }),
    el('div', { class: 'detail__metarow', children: [el('dt', { text: dict.detail.year }), metaYear] }),
    clientRow,
    el('div', { class: 'detail__metarow', children: [el('dt', { text: dict.detail.tools }), metaTools] }),
  );

  const info = el('div', { class: 'detail__info' });
  info.append(
    kicker,
    title,
    description,
    meta,
    el('h3', { class: 'detail__subtitle', text: dict.detail.links }),
    linksList,
  );

  const closeBtn = el('button', {
    class: 'modal__close',
    html: closeSvg(),
    attrs: { type: 'button', 'aria-label': dict.detail.close },
  });
  const prevBtn = el('button', {
    class: 'btn detail__navbtn',
    html: `${arrowSvg('left')}<span>${dict.detail.prevProject}</span>`,
    attrs: { type: 'button' },
  });
  const nextBtn = el('button', {
    class: 'btn detail__navbtn',
    html: `<span>${dict.detail.nextProject}</span>${arrowSvg('right')}`,
    attrs: { type: 'button' },
  });
  const footer = el('div', { class: 'detail__footer' });
  footer.append(prevBtn, nextBtn);

  const card = el('article', {
    class: 'detail',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'detail-title' },
  });
  card.append(closeBtn, stage, info, footer);

  const backdrop = el('div', { class: 'modal modal--detail', attrs: { role: 'presentation' } });
  backdrop.append(card);
  backdrop.hidden = true;

  function renderMedia(): void {
    if (!project) return;
    clearElement(stage);
    stage.append(mediaPrev, mediaNext, mediaCounter, dots);

    const media = project.media;
    if (media.length === 0) {
      stage.append(el('p', { class: 'detail__note', text: dict.detail.noMedia }));
      mediaPrev.hidden = true;
      mediaNext.hidden = true;
      mediaCounter.hidden = true;
      return;
    }

    media.forEach((item, i) => {
      const slide = buildSlide(item, dict);
      slide.classList.toggle('is-active', i === index);
      stage.insertBefore(slide, mediaCounter);
      const dot = el('button', {
        class: 'detail__dot',
        attrs: { type: 'button', 'aria-label': `${i + 1} / ${media.length}` },
        dataset: { index: String(i) },
      });
      if (i === index) dot.classList.add('is-active');
      dots.append(dot);
    });

    const single = media.length <= 1;
    mediaPrev.hidden = single;
    mediaNext.hidden = single;
    mediaCounter.hidden = single;
    mediaCounter.textContent = `${index + 1} / ${media.length}`;
    mediaPrev.disabled = index === 0;
    mediaNext.disabled = index === media.length - 1;
  }

  function updateMedia(): void {
    if (!project) return;
    const slides = Array.from(stage.querySelectorAll<HTMLElement>('.detail__slide'));
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
    const dotEls = Array.from(dots.children);
    dotEls.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    mediaCounter.textContent = `${index + 1} / ${project.media.length}`;
    mediaPrev.disabled = index === 0;
    mediaNext.disabled = index === project.media.length - 1;
  }

  function nextMedia(): void {
    if (!project) return;
    if (index < project.media.length - 1) {
      index += 1;
      updateMedia();
    }
  }
  function prevMedia(): void {
    if (index > 0) {
      index -= 1;
      updateMedia();
    }
  }

  function projectAt(offset: number): Project | undefined {
    if (!project) return undefined;
    const i = projects.findIndex((p) => p.id === project!.id);
    return projects[((i + offset) % projects.length + projects.length) % projects.length];
  }

  function render(next: Project): void {
    project = next;
    index = 0;

    kicker.textContent = `${next.category} / ${next.year}`;
    title.textContent = next.title;
    description.textContent = next.description;
    metaRole.textContent = next.role;
    metaYear.textContent = String(next.year);
    metaTools.textContent = joinTools(next.tools);
    metaClient.textContent = next.client ?? '—';
    clientRow.hidden = !next.client;

    clearElement(linksList);
    if (next.links.length === 0) {
      linksList.append(el('li', { class: 'detail__nolink', text: '—' }));
    } else {
      next.links.forEach((link) => {
        linksList.append(
          el('li', {
            children: [
              el('a', {
                class: 'detail__link',
                text: link.label,
                attrs: { href: link.url, target: '_blank', rel: 'noopener noreferrer' },
              }),
            ],
          }),
        );
      });
    }

    prevBtn.querySelector('span')!.textContent = dict.detail.prevProject;
    nextBtn.querySelector('span')!.textContent = dict.detail.nextProject;

    renderMedia();
  }

  const disposers = [
    on(closeBtn, 'click', () => actions.closeDetail()),
    on(backdrop, 'click', (event) => {
      if (event.target === backdrop) actions.closeDetail();
    }),
    on(mediaPrev, 'click', prevMedia),
    on(mediaNext, 'click', nextMedia),
    on(dots, 'click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('.detail__dot');
      if (!target) return;
      const i = Number(target.dataset.index);
      if (!Number.isNaN(i)) {
        index = i;
        updateMedia();
      }
    }),
    on(prevBtn, 'click', () => {
      const p = projectAt(-1);
      if (p) actions.openDetail(p.id);
    }),
    on(nextBtn, 'click', () => {
      const p = projectAt(1);
      if (p) actions.openDetail(p.id);
    }),
  ];

  return {
    el: backdrop,
    render,
    open(): boolean {
      if (!project) return false;
      backdrop.hidden = false;
      document.body.classList.add('has-modal');
      closeBtn.focus();
      return true;
    },
    close(): void {
      backdrop.hidden = true;
      if (!ctx.store.get().helpOpen) document.body.classList.remove('has-modal');
      project = null;
    },
    nextMedia,
    prevMedia,
    isOpen: () => !backdrop.hidden,
    update: updateMedia,
    dispose: () => disposers.forEach((d) => d()),
  };
}
