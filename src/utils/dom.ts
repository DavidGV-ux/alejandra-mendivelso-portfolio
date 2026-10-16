type ElementAttrs = {
  class?: string;
  id?: string;
  text?: string;
  html?: string;
  attrs?: Record<string, string>;
  dataset?: Record<string, string>;
  style?: Partial<CSSStyleDeclaration>;
  children?: Array<Node | string>;
  nonce?: string;
};

/** Crea un elemento tipado con atributos e hijos. Acepta opciones en 2.º o 3.er argumento. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementAttrs = {},
  extra: ElementAttrs = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const opts: ElementAttrs = { ...options, ...extra };
  if (opts.class) node.className = opts.class;
  if (opts.id) node.id = opts.id;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.html !== undefined) node.innerHTML = opts.html;
  if (opts.attrs) {
    for (const [key, value] of Object.entries(opts.attrs)) {
      node.setAttribute(key, value);
    }
  }
  if (opts.dataset) {
    for (const [key, value] of Object.entries(opts.dataset)) {
      node.dataset[key] = value;
    }
  }
  if (opts.style) Object.assign(node.style, opts.style);
  if (opts.children) {
    for (const child of opts.children) {
      node.append(child);
    }
  }
  return node;
}

export function qs<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T | null {
  return root.querySelector<T>(selector);
}

export function qsa<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

/** Añade un listener que devuelve una función para removerlo. */
export function on<K extends keyof WindowEventMap>(
  target: Window,
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void;
export function on<K extends keyof HTMLElementEventMap>(
  target: HTMLElement | Document | Window,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void;
export function on(
  target: EventTarget,
  type: string,
  handler: EventListenerOrEventListenerObject,
  options?: AddEventListenerOptions,
): () => void {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

export function clearElement(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}
