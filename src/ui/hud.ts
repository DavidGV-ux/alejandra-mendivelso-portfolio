import { el, on } from '@/utils/dom';
import type { UIContext, UIComponent } from '@/types/ui';

export function createHud(ctx: UIContext): UIComponent {
  const { dict, profile, store } = ctx;

  const brand = el('div', { class: 'hud__brand' });
  brand.append(
    el('span', { class: 'hud__name', text: profile.name }),
    el('span', { class: 'hud__role', text: profile.role }),
  );

  const meta = el('div', { class: 'hud__meta', attrs: { 'aria-live': 'polite' } });

  const viewBtn = el('button', {
    class: 'hud__cta',
    text: dict.works.view,
    attrs: { type: 'button' },
  });

  const side = el('div', { class: 'hud__side' });
  side.append(meta, viewBtn);

  const hud = el('header', { class: 'hud' });
  hud.append(brand, side);

  function update(): void {
    const { section, activeIndex, detailProjectId, helpOpen, introDone } = store.get();
    hud.classList.toggle('is-hidden', section !== 'works');
    const project = ctx.projects[activeIndex];
    if (project && section === 'works') {
      meta.textContent = `${project.category} / ${project.year}`;
    }
    viewBtn.hidden = section !== 'works' || !!detailProjectId || helpOpen || !introDone;
  }

  const disposers = [on(viewBtn, 'click', () => ctx.actions.openActive())];

  store.subscribe(update);
  update();

  return {
    el: hud,
    update,
    dispose: () => disposers.forEach((d) => d()),
  };
}
