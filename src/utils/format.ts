export { pad2 } from './math';

/** Texto seguro para atributos/alt. */
export const safeText = (value: string | undefined, fallback = ''): string =>
  (value ?? fallback).trim();

/** Construye una ruta de media a partir del id y el nombre de archivo. */
export const mediaPath = (projectId: string, file: string): string =>
  `/media/${projectId}/${file}`;

/** Lista legible de herramientas. */
export const joinTools = (tools: string[]): string => tools.join(' · ');
