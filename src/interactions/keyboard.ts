import { on } from '@/utils/dom';

interface KeyboardOptions {
  onPrev: () => void;
  onNext: () => void;
  onOpen: () => void;
  onClose: () => void;
  onHelp: () => void;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

export function attachKeyboard(options: KeyboardOptions): () => void {
  const handler = (event: KeyboardEvent): void => {
    if (isEditable(event.target)) return;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        options.onPrev();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        options.onNext();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        options.onOpen();
        break;
      case 'Escape':
        options.onClose();
        break;
      case '?':
      case 'h':
        options.onHelp();
        break;
      default:
        return;
    }
  };

  return on(window, 'keydown', handler);
}
