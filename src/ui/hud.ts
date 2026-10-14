import { el } from '@/utils/dom';
import type { UIContext, UIComponent } from '@/types/ui';

export function createHud(ctx: UIContext): UIComponent {
  const { dict, profile, store } = ctx;

  const brand = el('div', { class: 'hud__brand' });
  brand.append(
    el('span', { class: 'hud__name', text: profile.name }),
    el('span', { class: 'hud__role', text: profile.role }),
  );

  const meta = el('div', { class: 'hud__meta', attrs: { 'aria-live': 'polite' } });

  const hud = el('header', { class: 'hud' });
  hud.append(brand, meta);

  function update(): void {
    const { section, activeIndex } = store.get();
    hud.classList.toggle('is-hidden', section !== 'works');
    const project = ctx.projects[activeIndex];
    if (project && section === 'works') {
      meta.textContent = `${project.category} / ${project.year}`;
    }
  }

  store.subscribe(update);
  update();

  void dict;
  return { el: hud, update };
}
