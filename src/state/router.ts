import type { Section } from './store';

export interface Route {
  section: Section;
  projectId: string | null;
}

export function parseRoute(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const parts = clean.split('/').filter(Boolean);

  if (parts.length === 0) return { section: 'works', projectId: null };

  const [first, second] = parts;

  if (first === 'works') {
    return { section: 'works', projectId: second ?? null };
  }
  if (first === 'about') return { section: 'about', projectId: null };
  if (first === 'contact') return { section: 'contact', projectId: null };

  return { section: 'works', projectId: null };
}

export function buildPath(section: Section, projectId: string | null): string {
  if (section === 'works') return projectId ? `/works/${projectId}` : '/';
  return `/${section}`;
}

interface RouterOptions {
  onNavigate: (route: Route, isPop: boolean) => void;
}

export function createRouter({ onNavigate }: RouterOptions) {
  function handlePop(): void {
    onNavigate(parseRoute(window.location.pathname), true);
  }

  window.addEventListener('popstate', handlePop);

  return {
    start(): void {
      onNavigate(parseRoute(window.location.pathname), false);
    },
    push(section: Section, projectId: string | null, replace = false): void {
      const path = buildPath(section, projectId);
      if (path === window.location.pathname) return;
      if (replace) window.history.replaceState({ section, projectId }, '', path);
      else window.history.pushState({ section, projectId }, '', path);
    },
    dispose(): void {
      window.removeEventListener('popstate', handlePop);
    },
  };
}

export type Router = ReturnType<typeof createRouter>;
