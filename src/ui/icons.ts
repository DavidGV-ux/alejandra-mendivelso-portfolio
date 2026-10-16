import type { SocialLink } from '@/types/profile';

const paths: Record<SocialLink['icon'], string> = {
  instagram:
    '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>',
  linkedin:
    '<rect x="3" y="3" width="18" height="18" rx="3"/><line x1="7" y1="10" x2="7" y2="17"/><circle cx="7" cy="7" r="0.6" fill="currentColor" stroke="none"/><path d="M11 17v-4a2 2 0 0 1 4 0v4"/><line x1="11" y1="10" x2="11" y2="17"/>',
  behance:
    '<path d="M3 6h5.5a2.5 2.5 0 0 1 0 5H3zM3 11h6a2.5 2.5 0 0 1 0 5H3z"/><path d="M14 13h7a3.5 3.5 0 0 0-7 0 3.5 3.5 0 0 0 6 2.5"/><line x1="15" y1="6" x2="20" y2="6"/>',
  whatsapp:
    '<path d="M20 12a8 8 0 1 1-3.1-6.3L20 4l-1.4 3.2A8 8 0 0 1 20 12z"/><path d="M8.5 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.6-2-1-1 .8c-1-.5-1.8-1.3-2.3-2.3l.8-1-1-2z" fill="currentColor" stroke="none"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>',
  github:
    '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  dribbble:
    '<circle cx="12" cy="12" r="9"/><path d="M5 8c5 1 11 1 14 5M9 3.5C13 8 15 14 15 20.5M20 11c-6-1-11 2-13 8"/>',
  x: '<path d="M5 5l14 14M19 5 5 19"/>',
};

export function iconSvg(name: SocialLink['icon'], size = 18): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}

export type ArrowDirection = 'left' | 'right';

export function arrowSvg(direction: ArrowDirection, size = 18): string {
  const d = direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}

export function moonSvg(size = 18): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>`;
}

export function sunSvg(size = 18): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
}

export function closeSvg(size = 18): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
}

export function helpSvg(size = 18): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/></svg>`;
}

export function musicSvg(size = 18): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>`;
}
