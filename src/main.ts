import './styles/main.css';

import type { Scene3D } from '@/app3d';
import { loadContent, type Content } from '@/content';
import { detectCapabilities } from '@/core/capabilities';
import { applyThemeVariables, resolveMode } from '@/config/theme';
import { detectLocale, getDictionary, persistLocale } from '@/config/i18n';
import { siteConfig } from '@/config/site.config';
import { createAboutPanel } from '@/sections/about';
import { createContactPanel } from '@/sections/contact';
import { createFallbackList } from '@/fallback/listView2D';
import { createBottomBar } from '@/ui/bottomBar';
import { createHud } from '@/ui/hud';
import { createDetailView } from '@/ui/detailView';
import { createHelpCard } from '@/ui/helpCard';
import { createLoadingScreen } from '@/ui/loadingScreen';
import { createCursor, createOwnerCursor } from '@/ui/cursor';
import { createStore, type Section } from '@/state/store';
import { createRouter, type Route } from '@/state/router';
import { el, qs } from '@/utils/dom';
import type { ThemeMode } from '@/types/theme';
import type { UIContext, UIActions } from '@/types/ui';

/* ------------------------------------------------------------------ */
/* Nodos base                                                         */
/* ------------------------------------------------------------------ */
const canvas = qs<HTMLCanvasElement>('#scene')!;
const overlayRoot = qs<HTMLElement>('#overlay-root')!;
const uiRoot = qs<HTMLElement>('#ui-root')!;

const searchParams = new URLSearchParams(location.search);
const caps = detectCapabilities();

/* ------------------------------------------------------------------ */
/* Tema                                                               */
/* ------------------------------------------------------------------ */
function storedTheme(): ThemeMode {
  const value = localStorage.getItem(siteConfig.storageKeys.themeMode);
  return value === 'light' || value === 'dark' || value === 'auto' ? value : 'auto';
}
let themeMode: ThemeMode = storedTheme();
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
const resolvedTheme = (): 'light' | 'dark' => resolveMode(themeMode, prefersDark.matches);
applyThemeVariables(resolvedTheme());

/* ------------------------------------------------------------------ */
/* Idioma y contenido                                                 */
/* ------------------------------------------------------------------ */
let locale = detectLocale();
const dict = getDictionary(locale);
document.documentElement.lang = locale;

let content: Content;
try {
  content = await loadContent();
} catch (error) {
  renderFatalError(error);
  throw error;
}

/* ------------------------------------------------------------------ */
/* Store                                                             */
/* ------------------------------------------------------------------ */
const store = createStore({
  section: 'works',
  activeIndex: 0,
  targetIndex: 0,
  detailProjectId: null,
  helpOpen: false,
  introDone: false,
  loadingProgress: 0,
  ready: false,
});

/* ------------------------------------------------------------------ */
/* Referencias 3D (módulo diferido)                                   */
/* ------------------------------------------------------------------ */
const use3D = caps.webgl && !searchParams.has('2d');
let scene3d: Scene3D | null = null;
let scene3dLoading = false;
const pending3d: Array<(scene: Scene3D) => void> = [];

/** Ejecuta una acción 3D al instante o la encola si el módulo va en camino. */
function run3D(action: (scene: Scene3D) => void): boolean {
  if (scene3d) {
    action(scene3d);
    return true;
  }
  if (scene3dLoading) {
    pending3d.push(action);
    return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Acciones (referencian componentes declarados más abajo)            */
/* ------------------------------------------------------------------ */
const actions: UIActions = {
  goToSection: (section) => setSection(section),
  step(delta) {
    if (!store.get().introDone) return;
    scene3d?.step(delta);
  },
  goToIndex: (index) => scene3d?.goToIndex(index),
  openDetail(projectId) {
    if (!run3D((scene) => scene.openProject(projectId))) openDetailUI(projectId);
  },
  closeDetail() {
    if (!run3D((scene) => scene.closeDetail())) closeDetailUI();
  },
  toggleTheme: () => cycleTheme(),
  cycleTheme: () => cycleTheme(),
  setTheme(mode) {
    themeMode = mode;
    persistTheme();
    applyTheme(resolvedTheme());
  },
  toggleLocale() {
    locale = locale === 'es' ? 'en' : 'es';
    persistLocale(locale);
    window.location.reload();
  },
  openHelp() {
    helpCard.open();
    store.set({ helpOpen: true });
  },
  closeHelp: () => closeHelpUI(),
};

const uiContext: UIContext = {
  dict,
  profile: content.profile,
  projects: content.projects,
  store,
  actions,
  currentThemeMode: () => themeMode,
  currentLocale: () => locale,
};

/* ------------------------------------------------------------------ */
/* Componentes de UI                                                  */
/* ------------------------------------------------------------------ */
const helpCard = createHelpCard(uiContext, caps.isTouch);
const detailView = createDetailView(uiContext);
const aboutPanel = createAboutPanel(uiContext);
const contactPanel = createContactPanel(uiContext);
const fallbackList = createFallbackList(uiContext);
const bottomBar = createBottomBar(uiContext);
const hud = createHud(uiContext);
const loadingScreen = createLoadingScreen(dict, content.profile);
const cursor = createCursor(window.matchMedia('(pointer: fine)').matches, dict.cursor.client);
let loaderOpen = true;
const ownerCursor = createOwnerCursor(dict.cursor.owner, () => {
  const state = store.get();
  return (
    !loaderOpen &&
    state.introDone &&
    state.section === 'works' &&
    !state.helpOpen &&
    !state.detailProjectId
  );
});

uiRoot.append(bottomBar.el, hud.el);
overlayRoot.append(detailView.el, aboutPanel.el, contactPanel.el, fallbackList.el);
document.body.append(ownerCursor.el, cursor.el, helpCard.el, loadingScreen.el);

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
function openDetailUI(projectId: string): void {
  const index = content.projects.findIndex((p) => p.id === projectId);
  const project = content.projects[index];
  if (!project) return;
  detailView.render(project);
  detailView.open();
  store.set({ detailProjectId: projectId, activeIndex: index });
  aboutPanel.hide();
  contactPanel.hide();
}

function closeDetailUI(): void {
  if (!detailView.isOpen()) return;
  detailView.close();
  store.set({ detailProjectId: null });
  if (store.get().section === 'works') router.push('works', null);
}

function closeHelpUI(): void {
  if (!store.get().helpOpen) return;
  helpCard.close();
  store.set({ helpOpen: false });
}

function setSection(section: Section, fromRoute = false): void {
  store.set({ section });
  if (!fromRoute) router.push(section, null);
}

function updateInteractive(): void {
  const state = store.get();
  const worksActive =
    state.section === 'works' && !state.detailProjectId && !state.helpOpen && state.introDone;
  scene3d?.setInteractive(worksActive);
}

function applyTheme(mode: 'light' | 'dark'): void {
  applyThemeVariables(mode);
  scene3d?.setTheme(mode);
}

function persistTheme(): void {
  try {
    localStorage.setItem(siteConfig.storageKeys.themeMode, themeMode);
  } catch {
    /* almacenamiento no disponible */
  }
}

function cycleTheme(): void {
  const order: ThemeMode[] = ['light', 'dark', 'auto'];
  const current = order.indexOf(themeMode);
  themeMode = order[(current + 1) % order.length]!;
  persistTheme();
  applyTheme(resolvedTheme());
  bottomBar.update?.();
}

prefersDark.addEventListener('change', () => {
  if (themeMode === 'auto') applyTheme(resolvedTheme());
});

/* ------------------------------------------------------------------ */
/* Secciones visibles                                                 */
/* ------------------------------------------------------------------ */
store.subscribe((state, prev) => {
  if (state.section !== prev.section) {
    if (state.section !== 'about') aboutPanel.hide();
    if (state.section !== 'contact') contactPanel.hide();
    if (state.section === 'about') aboutPanel.show();
    if (state.section === 'contact') contactPanel.show();
  }
  if (
    state.section !== prev.section ||
    state.detailProjectId !== prev.detailProjectId ||
    state.helpOpen !== prev.helpOpen ||
    state.introDone !== prev.introDone
  ) {
    updateInteractive();
  }
  ownerCursor.sync();
});

/* ------------------------------------------------------------------ */
/* Router (deep linking)                                              */
/* ------------------------------------------------------------------ */
const router = createRouter({
  onNavigate: (route: Route) => {
    if (store.get().helpOpen) closeHelpUI();

    if (route.section !== 'works') {
      setSection(route.section, true);
      if (store.get().detailProjectId) closeDetailUI();
      return;
    }

    setSection('works', true);
    if (route.projectId) {
      const id = route.projectId;
      if (!run3D((scene) => scene.openProject(id))) openDetailUI(id);
    } else if (store.get().detailProjectId) {
      if (!run3D((scene) => scene.closeDetail(true))) closeDetailUI();
    }
  },
});

/* ------------------------------------------------------------------ */
/* Arranque                                                           */
/* ------------------------------------------------------------------ */
renderMeta();

if (use3D) {
  boot3D();
} else {
  startFallback();
}

router.start();

/* ------------------------------------------------------------------ */
/* 3D (carga diferida)                                                */
/* ------------------------------------------------------------------ */
function boot3D(): void {
  scene3dLoading = true;

  let chunkReady = false;
  let preloaded = false;
  let finished = false;
  let fakeProgress = 0;

  const ramp = window.setInterval(() => {
    if (chunkReady) return;
    fakeProgress = Math.min(45, fakeProgress + 2);
    loadingScreen.setProgress(fakeProgress);
  }, 120);

  const slowTimer = window.setTimeout(() => loadingScreen.showSlow(), 6000);
  const hardTimer = window.setTimeout(() => {
    preloaded = true;
    maybeFinish();
  }, 9000);

  function maybeFinish(): void {
    if (finished || !chunkReady || !preloaded) return;
    finished = true;
    window.clearInterval(ramp);
    window.clearTimeout(slowTimer);
    window.clearTimeout(hardTimer);
    loadingScreen.setProgress(100);
    window.setTimeout(() => {
      loadingScreen.hide(() => {
        loaderOpen = false;
        scene3d?.start();
        ownerCursor.sync();
      });
    }, 250);
  }

  import('@/app3d')
    .then(async ({ createScene3D }) => {
      scene3d = await createScene3D({
        canvas,
        caps,
        projects: content.projects,
        store,
        theme: resolvedTheme(),
        onProgress: (loaded, total) => {
          if (finished) return;
          loadingScreen.setProgress(total > 0 ? 45 + (loaded / total) * 43 : 60);
        },
        onPreloaded: () => {
          preloaded = true;
          maybeFinish();
        },
        onOpenDetail: (id) => {
          openDetailUI(id);
          router.push('works', id);
        },
        onCloseDetail: () => closeDetailUI(),
        onHoverChange: (hovering) => cursor.setInteractive(hovering),
        onIntroEnd: () => updateInteractive(),
      });

      for (const action of pending3d.splice(0)) action(scene3d);
      scene3dLoading = false;
      chunkReady = true;
      window.clearInterval(ramp);
      maybeFinish();
    })
    .catch((error: unknown) => {
      console.warn(error);
      scene3dLoading = false;
      pending3d.length = 0;
      window.clearInterval(ramp);
      window.clearTimeout(slowTimer);
      window.clearTimeout(hardTimer);
      startFallback();
    });
}

/* ------------------------------------------------------------------ */
/* Fallback 2D                                                        */
/* ------------------------------------------------------------------ */
function startFallback(): void {
  store.set({ ready: true, introDone: true });
  loadingScreen.setProgress(100);
  loadingScreen.hide(() => {
    loaderOpen = false;
    ownerCursor.sync();
  });
  fallbackList.el.hidden = false;
  fallbackList.el.classList.add('is-visible');
  canvas.hidden = true;
  cursor.setVisible(false);
  console.warn(dict.errors.webgl);
}

/* ------------------------------------------------------------------ */
/* Teclado global                                                     */
/* ------------------------------------------------------------------ */
window.addEventListener('keydown', (event) => {
  if (!store.get().introDone) return;
  const target = event.target as HTMLElement | null;
  const editable =
    !!target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable);

  const state = store.get();

  if (event.key === 'Escape') {
    if (state.helpOpen) {
      event.preventDefault();
      closeHelpUI();
    } else if (state.detailProjectId) {
      event.preventDefault();
      actions.closeDetail();
    } else if (state.section !== 'works') {
      event.preventDefault();
      actions.goToSection('works');
    }
    return;
  }

  if (editable) return;

  if (event.key === '?' || event.key === 'h') {
    event.preventDefault();
    actions.openHelp();
    return;
  }

  if (state.detailProjectId) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      detailView.prevMedia();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      detailView.nextMedia();
    }
    return;
  }

  if (state.section !== 'works') return;

  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault();
      actions.step(-1);
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault();
      actions.step(1);
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      scene3d?.openActive();
      break;
  }
});

/* ------------------------------------------------------------------ */
/* SEO / JSON-LD                                                      */
/* ------------------------------------------------------------------ */
function renderMeta(): void {
  document.title = siteConfig.title;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: content.profile.name,
    jobTitle: content.profile.role,
    description: siteConfig.description,
    address: {
      '@type': 'PostalAddress',
      addressLocality: content.profile.location,
    },
    email: content.profile.email,
    url: siteConfig.url,
    image: `${siteConfig.url}/og-image.png`,
    sameAs: content.profile.socials
      .map((s) => s.url)
      .filter((url) => url.startsWith('http')),
  };
  const script = el('script', { attrs: { type: 'application/ld+json' } });
  script.textContent = JSON.stringify(jsonLd);
  document.head.append(script);
}

/* ------------------------------------------------------------------ */
/* Error fatal                                                        */
/* ------------------------------------------------------------------ */
function renderFatalError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const box = el('div', { class: 'fatal', attrs: { role: 'alert' } });
  box.append(
    el('h1', { class: 'fatal__title', text: dict.errors.content }),
    el('pre', { class: 'fatal__detail', text: message }),
  );
  document.body.append(box);
}
