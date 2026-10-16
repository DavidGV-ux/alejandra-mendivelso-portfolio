import type { Locale } from '@/types/theme';
import { siteConfig } from '../site.config';
import { es, type Dictionary } from './es';
import { en } from './en';

const dictionaries: Record<Locale, Dictionary> = { es, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

const STORAGE_KEY = siteConfig.storageKeys.locale;

export function detectLocale(): Locale {
  // Intenta recuperar el idioma guardado en localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === 'es' || stored === 'en')) return stored as Locale;
  }
  // Fallback: inglés por defecto
  return 'en';
}

export function persistLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Reemplaza marcadores {clave} en una plantilla. */
export function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

export type { Dictionary } from './es';
