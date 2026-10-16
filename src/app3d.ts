/**
 * Módulo 3D cargado de forma diferida (`import('@/app3d')`). Todo lo que
 * toca three/gsap vive aquí para que el arranque (loader, UI, router,
 * fallback 2D) no descargue el motor 3D hasta conocer `use3D`.
 */
import { Scene } from 'three';

import { createIntro } from '@/animations/assembleIntro';
import { createCamera } from '@/core/camera';
import { createLoader } from '@/core/loader';
import { createLoop, type Loop } from '@/core/loop';
import { getQuality } from '@/core/quality';
import { createRenderer } from '@/core/renderer';
import { bindResize } from '@/core/resize';
import { buildCorridorLayout } from '@/scene/corridor';
import { createClouds } from '@/scene/clouds';
import { createEnvironment } from '@/scene/environment';
import { createGuideLine } from '@/scene/guideRing';
import { createLights } from '@/scene/lights';
import { createCorridorController } from '@/sections/corridor';
import type { Store } from '@/state/store';
import type { Project } from '@/types/project';
import type { Capabilities } from '@/types/theme';

export interface Scene3D {
  setTheme: (mode: 'light' | 'dark') => void;
  setInteractive: (enabled: boolean) => void;
  step: (delta: number) => void;
  goToIndex: (index: number) => void;
  selectActive: () => void;
  isSelected: () => boolean;
  releaseSelection: () => void;
  openActive: () => void;
  openProject: (id: string) => void;
  closeDetail: (immediate?: boolean) => void;
  /** Arranca el loop y la intro (se llama cuando el loader se ha ocultado). */
  start: () => void;
  dispose: () => void;
}

export interface Scene3DDeps {
  canvas: HTMLCanvasElement;
  caps: Capabilities;
  projects: Project[];
  store: Store;
  theme: 'light' | 'dark';
  onProgress: (loaded: number, total: number) => void;
  onPreloaded: () => void;
  onOpenDetail: (id: string) => void;
  onCloseDetail: () => void;
  onHoverChange: (hovering: boolean) => void;
  onIntroEnd: () => void;
  /** Tarjeta final del pasillo (foto + texto). */
  endCard: { title: string; subtitle: string; photo: string };
  /** Al pulsar la pantalla final se navega a Acerca de mí. */
  onOpenAbout: () => void;
}

/**
 * Las etiquetas 3D se dibujan una sola vez en un canvas; si la fuente aún no
 * está lista, quedan con la fuente de sistema. Se esperan las caras usadas
 * (con tope de seguridad) antes de construir la escena.
 */
async function ensureLabelFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  const load = Promise.all([
    document.fonts.load('600 36px "Space Grotesk"'),
    document.fonts.load('700 20px "DM Sans"'),
  ]).then(() => undefined);
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 1500));
  await Promise.race([load, timeout]);
}

export async function createScene3D(deps: Scene3DDeps): Promise<Scene3D> {
  await ensureLabelFonts();

  const { canvas, caps, projects, store } = deps;
  const quality = getQuality(caps);
  const layout = buildCorridorLayout(caps);
  const hires = new URLSearchParams(location.search).has('hires');

  const rendererHandle = createRenderer(canvas, quality, deps.theme);
  const camera = createCamera(layout);

  const scene = new Scene();
  const environment = createEnvironment(scene, deps.theme);
  const clouds = createClouds(scene, deps.theme, quality.tier === 'high' ? 14 : quality.tier === 'medium' ? 10 : 6);
  scene.add(camera);

  const lights = createLights(deps.theme);
  scene.add(lights.group);

  const loader = createLoader();

  let loop: Loop | null = null;
  const works = createCorridorController({
    camera,
    caps,
    quality,
    loader,
    projects,
    store,
    theme: deps.theme,
    onOpenDetail: deps.onOpenDetail,
    onCloseDetail: deps.onCloseDetail,
    onHoverChange: deps.onHoverChange,
    invalidate: () => loop?.invalidate(),
    endCard: deps.endCard,
    onOpenAbout: deps.onOpenAbout,
  });

  const guide = createGuideLine(projects.length, works.corridor.layout, deps.theme);
  scene.add(works.corridor.group, guide.line);

  works.attach(canvas);
  const resizeHandle = bindResize(
    canvas.parentElement ?? document.body,
    camera,
    rendererHandle.renderer,
    () => loop?.invalidate(),
  );

  /* ------------------------------------------------------------------ */
  /* Render bajo demanda + resolución adaptativa                        */
  /* ------------------------------------------------------------------ */
  let ratio = quality.pixelRatio;
  const renderSamples: number[] = [];
  let lastAdjust = 0;

  function renderFrame(dt: number): void {
    works.update(dt);
    clouds.update(camera);
    const start = performance.now();
    rendererHandle.renderer.render(scene, camera);
    if (hires || !intro.done()) return;

    renderSamples.push(performance.now() - start);
    if (renderSamples.length < 30) return;

    const avg = renderSamples.reduce((sum, v) => sum + v, 0) / renderSamples.length;
    renderSamples.length = 0;

    const now = performance.now();
    if (now - lastAdjust < 2000) return;
    if (avg > 18 && ratio > 1) {
      ratio = Math.max(1, ratio - 0.25);
      rendererHandle.setPixelRatio(ratio);
      lastAdjust = now;
      loop?.invalidate();
    } else if (avg < 8 && ratio < quality.pixelRatio) {
      ratio = Math.min(quality.pixelRatio, ratio + 0.25);
      rendererHandle.setPixelRatio(ratio);
      lastAdjust = now;
      loop?.invalidate();
    }
  }

  const intro = createIntro(works.corridor, caps.prefersReducedMotion);

  loop = createLoop(renderFrame, () => intro.done() && works.isSettled());

  void rendererHandle.renderer.compileAsync(scene, camera).catch(() => {});

  loader.manager.onProgress = (_url, loaded, total) => deps.onProgress(loaded, total);
  loader.manager.onLoad = deps.onPreloaded;
  works.preload();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) loop?.stop();
    else if (store.get().section === 'works') loop?.start();
  });

  store.subscribeKey('section', (section) => {
    if (section === 'works') loop?.start();
    else if (!store.get().detailProjectId) loop?.stop();
  });

  function finishIntro(): void {
    if (store.get().introDone) return;
    store.set({ introDone: true, ready: true });
    deps.onIntroEnd();
  }

  function start(): void {
    rendererHandle.renderer.render(scene, camera);
    loop?.start();

    const skipOnce = (): void => intro.skip();
    window.addEventListener('keydown', skipOnce, { once: true });
    canvas.addEventListener('pointerdown', skipOnce, { once: true });

    if (caps.prefersReducedMotion) {
      intro.skip();
      finishIntro();
      return;
    }

    intro.play();
    const total = 1.25 + (projects.length - 1) * 0.06 + 0.25;
    window.setTimeout(finishIntro, total * 1000);
  }

  return {
    setTheme: (mode) => {
      rendererHandle.applyTheme(mode);
      environment.setMode(mode);
      clouds.setMode(mode);
      lights.setMode(mode);
      works.setTheme(mode);
      guide.setMode(mode);
      loop?.invalidate();
    },
    setInteractive: (enabled) => works.setInteractive(enabled),
    step: (delta) => (delta < 0 ? works.prev() : works.next()),
    goToIndex: (index) => works.goToIndex(index),
    selectActive: () => works.selectActive(),
    isSelected: () => works.isSelected(),
    releaseSelection: () => works.releaseSelection(),
    openActive: () => works.openActive(),
    openProject: (id) => works.openProject(id),
    closeDetail: (immediate) => works.closeDetail(immediate),
    start,
    dispose: () => {
      resizeHandle.dispose();
      works.dispose();
      clouds.dispose();
      loader.dispose();
      rendererHandle.dispose();
    },
  };
}
