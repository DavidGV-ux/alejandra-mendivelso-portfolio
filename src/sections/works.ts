import type { PerspectiveCamera } from 'three';
import { createSpiral, type Spiral } from '@/scene/spiral';
import { createCameraRig, type CameraRig } from '@/animations/cameraTransitions';
import { createPicker } from '@/interactions/raycaster';
import { attachHover } from '@/interactions/hover';
import { attachDrag } from '@/interactions/drag';
import { attachWheel } from '@/interactions/wheel';
import { attachGestures } from '@/interactions/gestures';
import { sceneConfig } from '@/config/scene.config';
import { clamp } from '@/utils/math';
import type { FrameHandle } from '@/scene/frame';
import type { Project } from '@/types/project';
import type { Capabilities } from '@/types/theme';
import type { LoaderHandle } from '@/core/loader';
import type { QualityPreset } from '@/core/quality';
import type { Store } from '@/state/store';

export interface WorksController {
  spiral: Spiral;
  rig: CameraRig;
  update: (dt: number) => void;
  next: () => void;
  prev: () => void;
  goToIndex: (index: number) => void;
  openActive: () => void;
  openProject: (id: string) => void;
  closeDetail: (immediate?: boolean) => void;
  setInteractive: (enabled: boolean) => void;
  setCursor: (interactive: boolean) => void;
  attach: (dom: HTMLElement) => void;
  activeIndex: () => number;
  dispose: () => void;
}

interface WorksDeps {
  camera: PerspectiveCamera;
  caps: Capabilities;
  quality: QualityPreset;
  loader: LoaderHandle;
  projects: Project[];
  store: Store;
  onOpenDetail: (id: string) => void;
  onCloseDetail: () => void;
  onHoverChange: (hovering: boolean) => void;
}

const PIXELS_PER_STEP = 280;

export function createWorksController(deps: WorksDeps): WorksController {
  const { camera, caps, quality, loader, projects, store } = deps;
  const total = projects.length;
  const reducedMotion = caps.prefersReducedMotion;

  const spiral = createSpiral(projects, caps);
  const rig = createCameraRig(camera, spiral.layout, total, reducedMotion);
  const picker = createPicker(camera, document.body);

  let progress = 0;
  let target = 0;
  let interactive = true;
  let dragging = false;
  let dragStartTarget = 0;
  let pointerX = 0;
  let pointerY = 0;
  let hovered: FrameHandle | null = null;
  const currentFov = { value: camera.fov };
  const baseFov = { value: camera.fov };
  const initialFov = camera.fov;

  const loaded = new Set<string>();
  const loading = new Set<string>();

  function clampTarget(value: number): number {
    return clamp(value, 0, Math.max(0, total - 1));
  }

  function activeIndex(): number {
    return clamp(Math.round(progress), 0, Math.max(0, total - 1));
  }

  function loadAround(index: number): void {
    if (!interactive) return;
    const window = [index - 2, index - 1, index, index + 1, index + 2];
    for (const i of window) {
      if (i < 0 || i >= total) continue;
      const project = projects[i];
      const frame = spiral.frames[i];
      if (!project || !frame) continue;
      if (loaded.has(project.id) || loading.has(project.id)) continue;
      loading.add(project.id);
      loader
        .loadTexture(project.cover, quality.textureMax)
        .then((texture) => {
          frame.setImage(texture);
          loaded.add(project.id);
        })
        .catch((error) => console.warn('[media]', error))
        .finally(() => loading.delete(project.id));
    }
  }

  function applyFocusOpacity(focusedIndex: number | null): void {
    spiral.frames.forEach((frame) => {
      frame.setFocused(focusedIndex !== null && frame.index !== focusedIndex);
    });
  }

  function step(delta: number): void {
    if (!interactive) return;
    target = clampTarget(Math.round(target) + delta);
    if (reducedMotion) progress = target;
  }

  function goToIndex(index: number): void {
    target = clampTarget(index);
    if (reducedMotion) progress = target;
  }

  function doOpen(index: number): void {
    const project = projects[index];
    if (!project) return;
    rig.focus(index, reducedMotion);
    applyFocusOpacity(index);
    interactive = false;
    deps.onOpenDetail(project.id);
  }

  function openActive(): void {
    doOpen(activeIndex());
  }

  function openProject(id: string): void {
    const index = projects.findIndex((p) => p.id === id);
    if (index < 0) return;
    progress = index;
    target = index;
    doOpen(index);
  }

  function closeDetail(immediate = false): void {
    applyFocusOpacity(null);
    rig.release(progress, reducedMotion || immediate);
    interactive = true;
    deps.onCloseDetail();
  }

  function update(dt: number): void {
    const lambda = reducedMotion ? 1000 : 6.5;
    progress += (target - progress) * (1 - Math.exp(-lambda * dt));
    if (Math.abs(target - progress) < 0.001) progress = target;

    rig.setProgress(progress);
    spiral.setActiveIndex(activeIndex());
    spiral.update(dt);
    loadAround(activeIndex());

    if (Math.abs(currentFov.value - baseFov.value) > 0.01) {
      currentFov.value += (baseFov.value - currentFov.value) * (1 - Math.exp(-6 * dt));
      camera.fov = currentFov.value;
      camera.updateProjectionMatrix();
    }
  }

  function handleDrag(dx: number): void {
    target = clampTarget(dragStartTarget - dx / PIXELS_PER_STEP);
    if (reducedMotion) progress = target;
  }

  function handleDragEnd(dx: number, velocityX: number): void {
    const momentum = clamp(-velocityX * 0.35, -1.4, 1.4);
    target = clampTarget(Math.round(clampTarget(dragStartTarget - dx / PIXELS_PER_STEP) + momentum));
    if (reducedMotion) progress = target;
  }

  function handleTap(): void {
    if (!interactive) return;
    const hit = picker.pick(pointerX, pointerY, spiral.frames);
    if (hit) {
      if (hit.index === activeIndex()) doOpen(hit.index);
      else goToIndex(hit.index);
    }
  }

  function attach(dom: HTMLElement): void {
    const pointerTrack = (event: PointerEvent): void => {
      pointerX = event.clientX;
      pointerY = event.clientY;
    };
    window.addEventListener('pointermove', pointerTrack);

    attachHover(dom, {
      pick: (x, y) => picker.pick(x, y, spiral.frames),
      onEnter: (frame) => {
        hovered = frame;
        frame.setHover(true);
        deps.onHoverChange(true);
      },
      onLeave: (frame) => {
        frame.setHover(false);
        if (hovered === frame) hovered = null;
        deps.onHoverChange(false);
      },
      isEnabled: () => interactive && !dragging && !store.get().detailProjectId,
    });

    attachDrag(dom, {
      threshold: sceneConfig.controls.dragThreshold / 6,
      onDragStart: () => {
        dragging = true;
        dragStartTarget = target;
        if (hovered) hovered.setHover(false);
        deps.onHoverChange(false);
      },
      onDrag: (dx) => handleDrag(dx),
      onDragEnd: (dx, velocityX) => {
        dragging = false;
        handleDragEnd(dx, velocityX);
      },
      onTap: handleTap,
    });

    attachWheel(dom, {
      onWheel: (sign) => {
        if (!interactive) return;
        step(sign > 0 ? 1 : -1);
      },
    });

    attachGestures(dom, {
      onPinch: (deltaFov) => {
        if (!interactive) return;
        baseFov.value = clamp(baseFov.value + deltaFov, 28, 60);
      },
      onPinchEnd: () => {
        baseFov.value = initialFov;
      },
    });

    dom.addEventListener('pointerleave', () => deps.onHoverChange(false));
  }

  spiral.setActiveIndex(0);
  loadAround(0);

  return {
    spiral,
    rig,
    update,
    next: () => step(1),
    prev: () => step(-1),
    goToIndex,
    openActive,
    openProject,
    closeDetail,
    setInteractive: (enabled) => {
      interactive = enabled;
    },
    setCursor: (value) => deps.onHoverChange(value),
    attach,
    activeIndex,
    dispose: () => {
      rig.dispose();
      spiral.dispose();
    },
  };
}
