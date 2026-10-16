import { el, on } from '@/utils/dom';
import { pad2 } from '@/utils/format';
import { arrowSvg, moonSvg, sunSvg, helpSvg, musicSvg } from './icons';
import type { UIContext, UIComponent } from '@/types/ui';
import type { Section } from '@/state/store';

export function createBottomBar(ctx: UIContext): UIComponent {
  const { dict, store, actions } = ctx;

  const sectionButtons = new Map<Section, HTMLButtonElement>();
  const sectionGroup = el('div', {
    class: 'bar__group bar__sections',
    attrs: { role: 'tablist', 'aria-label': dict.nav.sections },
  });
  (['works', 'about', 'contact'] as const).forEach((section) => {
    const btn = el('button', {
      class: 'bar__tab',
      text: dict.nav[section],
      attrs: { type: 'button', role: 'tab', 'aria-selected': 'false' },
      dataset: { section },
    });
    sectionButtons.set(section, btn);
    sectionGroup.append(btn);
  });

  const prevBtn = el('button', {
    class: 'bar__icon',
    html: arrowSvg('left'),
    attrs: { type: 'button', 'aria-label': dict.nav.prev },
  });
  const nextBtn = el('button', {
    class: 'bar__icon',
    html: arrowSvg('right'),
    attrs: { type: 'button', 'aria-label': dict.nav.next },
  });
  const counter = el('span', {
    class: 'bar__counter',
    attrs: { 'aria-live': 'polite' },
  });

  const navGroup = el('div', { class: 'bar__group bar__nav' });
  navGroup.append(prevBtn, counter, nextBtn);

  const themeBtn = el('button', {
    class: 'bar__icon',
    attrs: { type: 'button', 'aria-label': dict.nav.theme },
  });
  const localeBtn = el('button', {
    class: 'bar__icon bar__locale',
    text: ctx.currentLocale().toUpperCase(),
    attrs: { type: 'button', 'aria-label': dict.nav.changeLanguage },
  });
  const musicBtn = el('button', {
    class: 'bar__icon bar__music',
    html: musicSvg(),
    attrs: {
      type: 'button',
      'aria-pressed': 'false',
      'aria-label': dict.nav.musicOff,
    },
  });
  const helpBtn = el('button', {
    class: 'bar__icon',
    html: helpSvg(),
    attrs: { type: 'button', 'aria-label': dict.nav.help },
  });
  const toolsGroup = el('div', { class: 'bar__group bar__tools' });
  toolsGroup.append(themeBtn, localeBtn, musicBtn, helpBtn);

  const bar = el('nav', {
    class: 'bar',
    attrs: { 'aria-label': dict.nav.bar },
  });
  bar.append(sectionGroup, navGroup, toolsGroup);

  function renderCounter(): void {
    const { activeIndex } = store.get();
    const total = ctx.projects.length;
    counter.textContent = `${pad2(activeIndex + 1)} / ${pad2(total)}`;
  }

  function renderTheme(): void {
    const mode = ctx.currentThemeMode();
    const resolved = document.documentElement.dataset.theme;
    themeBtn.innerHTML = resolved === 'dark' ? sunSvg() : moonSvg();
    themeBtn.dataset.mode = mode;
  }

  function renderSections(): void {
    const { section } = store.get();
    sectionButtons.forEach((btn, key) => {
      const active = key === section;
      btn.setAttribute('aria-selected', String(active));
      btn.classList.toggle('is-active', active);
    });
    navGroup.classList.toggle('is-dimmed', section !== 'works');
  }

  function renderMusic(): void {
    const playing = ctx.music.isPlaying();
    musicBtn.setAttribute('aria-pressed', String(playing));
    musicBtn.setAttribute('aria-label', playing ? dict.nav.musicOn : dict.nav.musicOff);
    musicBtn.classList.toggle('is-active', playing);
  }

  function update(): void {
    renderCounter();
    renderSections();
    renderTheme();
    renderMusic();
  }

  const disposers = [
    on(prevBtn, 'click', () => actions.step(-1)),
    on(nextBtn, 'click', () => actions.step(1)),
    on(helpBtn, 'click', () => actions.openHelp()),
    on(themeBtn, 'click', () => actions.cycleTheme()),
    on(localeBtn, 'click', () => actions.toggleLocale()),
    on(musicBtn, 'click', () => ctx.music.toggle()),
    ...[...sectionButtons.entries()].map(([section, btn]) =>
      on(btn, 'click', () => actions.goToSection(section)),
    ),
  ];

  ctx.music.setOnChange(renderMusic);
  store.subscribe(update);
  update();

  return {
    el: bar,
    update,
    dispose: () => disposers.forEach((d) => d()),
  };
}
