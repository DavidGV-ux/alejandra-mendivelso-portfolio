import { el, on } from '@/utils/dom';
import { iconSvg } from '@/ui/icons';
import type { UIContext, UIComponent } from '@/types/ui';

export interface ContactPanel extends UIComponent {
  show: () => void;
  hide: () => void;
  isVisible: () => boolean;
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

  const aside = el('div', { class: 'contact__aside' });
  aside.append(
    el('h3', { class: 'card__title', text: t.socials }),
    socials,
    el('p', { class: 'contact__direct' }, {
      children: [
        el('span', { text: t.directEmail + ': ' }),
        el('a', { class: 'link', text: profile.email, attrs: { href: `mailto:${profile.email}` } }),
      ],
    }),
  );

  if (profile.calcom) {
    const iframe = el('iframe', {
      class: 'contact__cal',
      attrs: {
        src: `https://cal.com/${profile.calcom}?embed=true`,
        title: t.schedule,
        loading: 'lazy',
      },
    });
    aside.append(el('h3', { class: 'card__title', text: t.schedule }), iframe);
  }

  const inner = el('div', { class: 'panel__inner panel__inner--contact' });
  inner.append(
    el('div', { class: 'contact__intro' }, {
      children: [
        el('h2', { class: 'panel__title', id: 'contact-title', text: t.title }),
        el('p', { class: 'panel__intro', text: t.intro }),
      ],
    }),
    el('div', { class: 'contact__grid' }, { children: [form, aside] }),
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
    dispose: disposeSubmit,
  };
}
