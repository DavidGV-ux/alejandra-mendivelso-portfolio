/**
 * Módulo 3D cargado de forma diferida (`import('@/app3d')`). Todo lo que
 * toca three/gsap vive aquí para que el arranque (loader, UI, router,
 * fallback 2D) no descargue el motor 3D hasta conocer `use3D`.
 */
import { Scene } from 'three';

import { createIntro } from '@/animations/assembleIntro';
import { createCamera } from '@/core/camera';
import { createLoader } from '@/core/loader';
import { createLoop } from '@/core/loop';
import { getQuality } from '@/core/quality';
import { createRenderer } from '@/core/renderer';
import { bindResize } from '@/core/resize';
import { buildCorridorLayout } from '@/scene/corridor';
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
}

export function createScene3D(deps: Scene3DDeps): Scene3D {
  const { canvas, caps, projects, store } = deps;
  const quality = getQuality(caps);
  const layout = buildCorridorLayout(caps);

  const rendererHandle = createRenderer(canvas, quality, deps.theme);
  const camera = createCamera(layout);

  const scene = new Scene();
  const environment = createEnvironment(scene, deps.theme);
  scene.add(camera);

  const lights = createLights(deps.theme);
  scene.add(lights.group);

  const loader = createLoader();
  const works = createCorridorController({
    camera,
    caps,
    quality,
    loader,
    projects,
    store,
    onOpenDetail: deps.onOpenDetail,
    onCloseDetail: deps.onCloseDetail,
    onHoverChange: deps.onHoverChange,
  });

  const guide = createGuideLine(projects.length, works.corridor.layout);
  scene.add(works.corridor.group, guide.line);

  works.attach(canvas);
  bindResize(canvas.parentElement ?? document.body, camera, rendererHandle.renderer);

  const loop = createLoop((dt) => {
    works.update(dt);
    rendererHandle.renderer.render(scene, camera);
  });

  const intro = createIntro(works.corridor, caps.prefersReducedMotion);

  loader.manager.onProgress = (_url, loaded, total) => deps.onProgress(loaded, total);
  loader.manager.onLoad = deps.onPreloaded;
  works.preload();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) loop.stop();
    else if (store.get().section === 'works') loop.start();
  });

  store.subscribeKey('section', (section) => {
    if (section === 'works') loop.start();
    else if (!store.get().detailProjectId) loop.stop();
  });

  function finishIntro(): void {
    if (store.get().introDone) return;
    store.set({ introDone: true, ready: true });
    deps.onIntroEnd();
  }

  function start(): void {
    loop.start();

    const skipOnce = (): void => intro.skip();
    window.addEventListener('keydown', skipOnce, { once: true });
    canvas.addEventListener('pointerdown', skipOnce, { once: true });

    if (caps.prefersReducedMotion) {
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
      lights.setMode(mode);
    },
    setInteractive: (enabled) => works.setInteractive(enabled),
    step: (delta) => (delta < 0 ? works.prev() : works.next()),
    goToIndex: (index) => works.goToIndex(index),
    openActive: () => works.openActive(),
    openProject: (id) => works.openProject(id),
    closeDetail: (immediate) => works.closeDetail(immediate),
    start,
    dispose: () => {
      works.dispose();
      loader.dispose();
    },
  };
}
