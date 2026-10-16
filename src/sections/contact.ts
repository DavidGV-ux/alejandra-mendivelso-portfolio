import { el, on } from '@/utils/dom';
import { iconSvg } from '@/ui/icons';
import type { UIContext, UIComponent } from '@/types/ui';

export interface ContactPanel extends UIComponent {
  show: () => void;
  hide: () => void;
  isVisible: () => boolean;
  scrollToCv: () => void;
}

interface FieldRefs {
  input: HTMLInputElement | HTMLTextAreaElement;
  error: HTMLElement;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createContactPanel(ctx: UIContext): ContactPanel {
  const { dict, profile } = ctx;
  const t = dict.contact;

  function makeField(
    name: string,
    label: string,
    placeholder: string,
    type: 'text' | 'email' | 'textarea',
  ): { wrapper: HTMLElement; ref: FieldRefs } {
    const id = `contact-${name}`;
    const error = el('span', { class: 'field__error', attrs: { id: `${id}-error`, role: 'alert' } });

    let input: HTMLInputElement | HTMLTextAreaElement;
    if (type === 'textarea') {
      input = el('textarea', {
        class: 'field__input',
        attrs: { id, name, placeholder, rows: '5', 'aria-describedby': `${id}-error` },
      });
    } else {
      input = el('input', {
        class: 'field__input',
        attrs: { id, name, type, placeholder, 'aria-describedby': `${id}-error`, autocomplete: name === 'email' ? 'email' : 'name' },
      });
    }

    const wrapper = el('div', { class: 'field' });
    wrapper.append(el('label', { class: 'field__label', text: label, attrs: { for: id } }), input, error);
    return { wrapper, ref: { input, error } };
  }

  const nameField = makeField('name', t.name, t.namePlaceholder, 'text');
  const emailField = makeField('email', t.email, t.emailPlaceholder, 'email');
  const messageField = makeField('message', t.message, t.messagePlaceholder, 'textarea');

  const submit = el('button', {
    class: 'btn btn--primary',
    text: t.send,
    attrs: { type: 'submit' },
  });
  const status = el('p', { class: 'contact__status', attrs: { 'aria-live': 'polite' } });

  const form = el('form', { class: 'contact__form', attrs: { novalidate: 'true' } });
  form.append(
    nameField.wrapper,
    emailField.wrapper,
    messageField.wrapper,
    el('div', { class: 'contact__actions', children: [submit] }),
    status,
  );

  function validate(): boolean {
    let ok = true;
    const name = nameField.ref.input.value.trim();
    const email = emailField.ref.input.value.trim();
    const message = messageField.ref.input.value.trim();

    const checks: Array<[FieldRefs, string]> = [];
    if (!name) checks.push([nameField.ref, t.required]);
    if (!email) checks.push([emailField.ref, t.required]);
    else if (!EMAIL_RE.test(email)) checks.push([emailField.ref, t.invalidEmail]);
    if (!message) checks.push([messageField.ref, t.required]);
    else if (message.length < 10) checks.push([messageField.ref, t.tooShort]);

    const invalid = new Set(checks.map(([ref]) => ref.input));
    [nameField, emailField, messageField].forEach(({ ref }) => {
      const messageText = checks.find(([r]) => r === ref)?.[1] ?? '';
      ref.error.textContent = messageText;
      ref.input.setAttribute('aria-invalid', String(messageText !== ''));
      ref.input.classList.toggle('is-invalid', messageText !== '');
    });

    if (invalid.size > 0) {
      ok = false;
      (invalid.values().next().value as HTMLElement | undefined)?.focus();
    }
    return ok;
  }

  let sending = false;

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (sending) return;
    if (!validate()) return;

    sending = true;
    submit.disabled = true;
    submit.textContent = t.sending;
    status.textContent = '';

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameField.ref.input.value.trim(),
          email: emailField.ref.input.value.trim(),
          message: messageField.ref.input.value.trim(),
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      status.textContent = t.success;
      status.className = 'contact__status is-success';
      form.reset();
    } catch {
      status.textContent = t.error;
      status.className = 'contact__status is-error';
    } finally {
      sending = false;
      submit.disabled = false;
      submit.textContent = t.send;
    }
  }

  const socials = el('ul', { class: 'socials' });
  for (const social of profile.socials) {
    socials.append(
      el('li', {}, {
        children: [
          el('a', {
            class: 'social',
            html: `${iconSvg(social.icon)}<span>${social.label}</span>`,
            attrs: {
              href: social.url,
              target: social.url.startsWith('mailto:') ? '_self' : '_blank',
              rel: 'noopener noreferrer',
              'aria-label': social.label,
            },
          }),
        ],
      }),
    );
  }

  const details = el('dl', { class: 'contact__details' });
  details.append(
    el('div', { class: 'contact__detail' }, {
      children: [
        el('dt', { class: 'contact__detail-label', text: t.location }),
        el('dd', { class: 'contact__detail-value', text: profile.location }),
      ],
    }),
  );
  if (profile.phone) {
    const tel = profile.phone.replace(/[^\d+]/g, '');
    details.append(
      el('div', { class: 'contact__detail' }, {
        children: [
          el('dt', { class: 'contact__detail-label', text: t.phone }),
          el('dd', { class: 'contact__detail-value' }, {
            children: [
              el('a', { class: 'link', text: profile.phone, attrs: { href: `tel:${tel}` } }),
            ],
          }),
        ],
      }),
    );
  }
  details.append(
    el('div', { class: 'contact__detail' }, {
      children: [
        el('dt', { class: 'contact__detail-label', text: t.email }),
        el('dd', { class: 'contact__detail-value' }, {
          children: [
            el('a', {
              class: 'link',
              text: profile.email,
              attrs: { href: `mailto:${profile.email}` },
            }),
          ],
        }),
      ],
    }),
  );

  const aside = el('div', { class: 'contact__aside' });
  aside.append(
    el('h3', { class: 'card__title', text: t.socials }),
    socials,
    el('h3', { class: 'card__title', text: t.details }),
    details,
  );

  const mailto = `mailto:${profile.email}?subject=${encodeURIComponent(t.emailSubject)}`;
  const cta = el('div', { class: 'contact__cta' });
  cta.append(
    el('a', {
      class: 'btn btn--primary',
      text: t.emailCta,
      attrs: { href: mailto },
    }),
    el('p', { class: 'contact__direct' }, {
      children: [
        el('span', { text: `${t.directEmail}: ` }),
        el('a', { class: 'link', text: profile.email, attrs: { href: `mailto:${profile.email}` } }),
      ],
    }),
  );

  const cvGrid = el('div', { class: 'cv__grid' });
  for (const cv of profile.cv) {
    if (!cv.file) continue;
    const actions = el('div', { class: 'cv-card__actions' });
    actions.append(
      el('a', {
        class: 'btn',
        text: t.cvView,
        attrs: {
          href: cv.file,
          target: '_blank',
          rel: 'noopener noreferrer',
          'aria-label': `${t.cvView}: ${cv.title}`,
        },
      }),
      el('a', {
        class: 'btn',
        text: t.cvDownload,
        attrs: { href: cv.file, download: '', 'aria-label': `${t.cvDownload}: ${cv.title}` },
      }),
    );
    cvGrid.append(
      el('article', { class: 'cv-card' }, {
        children: [
          el('h4', { class: 'cv-card__title', text: cv.title }),
          el('p', { class: 'cv-card__desc', text: cv.description }),
          actions,
        ],
      }),
    );
  }

  const cvSection = el('section', { class: 'cv' });
  cvSection.append(
    el('h3', { class: 'cv__title', text: t.cvTitle }),
    el('p', { class: 'cv__intro', text: t.cvIntro }),
    cvGrid,
  );

  const footerLinks = el('ul', { class: 'site-footer__links' });
  for (const social of profile.socials) {
    footerLinks.append(
      el('li', {}, {
        children: [
          el('a', {
            class: 'link',
            text: social.label,
            attrs: {
              href: social.url,
              target: social.url.startsWith('mailto:') ? '_self' : '_blank',
              rel: 'noopener noreferrer',
            },
          }),
        ],
      }),
    );
  }

  const year = new Date().getFullYear();
  const footer = el('footer', {
    class: 'site-footer',
    attrs: { 'aria-label': dict.footer.label },
  });
  footer.append(
    el('p', { class: 'site-footer__copy', text: `© ${year} ${profile.name} — ${dict.footer.note}` }),
    footerLinks,
  );

  const inner = el('div', { class: 'panel__inner panel__inner--contact' });
  inner.append(
    el('div', { class: 'contact__intro' }, {
      children: [
        el('p', { class: 'panel__kicker', text: t.label }),
        el('h2', { class: 'panel__title', id: 'contact-title', text: t.title }),
        el('p', { class: 'panel__intro', text: t.intro }),
        cta,
      ],
    }),
    el('div', { class: 'contact__grid' }, { children: [form, aside] }),
    cvSection,
    footer,
  );

  const panel = el('section', {
    class: 'panel panel--contact',
    attrs: { 'aria-labelledby': 'contact-title', tabindex: '-1' },
  });
  panel.append(inner);
  panel.hidden = true;

  const disposeSubmit = on(form, 'submit', (event) => {
    void handleSubmit(event as SubmitEvent);
  });

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
    scrollToCv: () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      cvSection.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    },
    dispose: disposeSubmit,
  };
}
