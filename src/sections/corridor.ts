import type { PerspectiveCamera } from 'three';
import { createCorridor, type Corridor } from '@/scene/corridor';
import {
  createCameraFreeLook,
  type CameraFreeLook,
  YAW_SENSITIVITY,
  PITCH_SENSITIVITY,
} from '@/animations/cameraFreeLook';
import { createPicker } from '@/interactions/raycaster';
import { attachHover } from '@/interactions/hover';
import { attachDrag } from '@/interactions/drag';
import { attachWheel } from '@/interactions/wheel';
import { attachGestures } from '@/interactions/gestures';
import type { FrameHandle } from '@/scene/frame';
import type { Project } from '@/types/project';
import type { Capabilities } from '@/types/theme';
import type { LoaderHandle } from '@/core/loader';
import type { QualityPreset } from '@/core/quality';
import type { Store } from '@/state/store';

export interface CorridorController {
  corridor: Corridor;
  cameraRig: CameraFreeLook;
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

interface Deps {
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

export function createCorridorController(deps: Deps): CorridorController {
  const { camera, caps, quality, loader, projects, store } = deps;
  const total = projects.length;
  const reducedMotion = caps.prefersReducedMotion;

  const corridor = createCorridor(projects, caps);
  const cameraRig = createCameraFreeLook(camera);
  let picker: ReturnType<typeof createPicker> | null = null;

  let progress = 0;
  let target = 0;
  let interactive = true;
  let draggingLook = false;
  let hovered: FrameHandle | null = null;
  let pointerX = 0;
  let pointerY = 0;
  let dragStartLook = { yaw: 0, pitch: 0 };
  let dragStartFov = 0;

  const loaded = new Set<string>();
  const loading = new Set<string>();

  function clampTarget(v: number): number {
    if (total <= 0) return 0;
    return Math.max(0, Math.min(total - 1, v));
  }

  function activeIndex(): number {
    return Math.round(progress);
  }

  function travelZFor(index: number): number {
    const center = ((total - 1) / 2) * corridor.layout.spacing;
    return index * corridor.layout.spacing - center;
  }

  function loadAround(index: number): void {
    const w = [index - 2, index - 1, index, index + 1, index + 2];
    for (const i of w) {
      if (i < 0 || i >= total) continue;
      const p = projects[i];
      const f = corridor.frames[i];
      if (!p || !f) continue;
      if (loaded.has(p.id) || loading.has(p.id)) continue;
      loading.add(p.id);
      loader
        .loadTexture(p.cover, quality.textureMax)
        .then((t) => {
          f.setImage(t);
          loaded.add(p.id);
        })
        .catch(() => {})
        .finally(() => loading.delete(p.id));
    }
  }

  function applyFocusOpacity(focused: number | null): void {
    corridor.frames.forEach((f) => f.setFocused(focused !== null && f.index !== focused));
  }

  function step(delta: number): void {
    if (!interactive) return;
    target = clampTarget(target + delta);
    if (reducedMotion) progress = target;
  }

  function goToIndex(i: number): void {
    target = clampTarget(i);
    if (reducedMotion) progress = target;
  }

  function doOpen(i: number): void {
    const p = projects[i];
    if (!p) return;
    cameraRig.focusOn(i, total, corridor.layout);
    applyFocusOpacity(i);
    interactive = false;
    deps.onOpenDetail(p.id);
  }

  function openActive(): void {
    doOpen(activeIndex());
  }

  function openProject(id: string): void {
    const i = projects.findIndex((p) => p.id === id);
    if (i < 0) return;
    progress = i;
    target = i;
    doOpen(i);
  }

  function closeDetail(immediate = false): void {
    applyFocusOpacity(null);
    cameraRig.release();
    void immediate;
    interactive = true;
    deps.onCloseDetail();
  }

  function update(dt: number): void {
    const lambda = reducedMotion ? 1000 : 6;
    progress += (target - progress) * (1 - Math.exp(-lambda * dt));
    if (Math.abs(target - progress) < 0.001) progress = target;

    if (!cameraRig.isFocused()) {
      cameraRig.setTravel(travelZFor(progress));
    }
    cameraRig.update(dt);
    corridor.setActiveIndex(activeIndex());
    corridor.update(dt);
    loadAround(activeIndex());
  }

  function attach(dom: HTMLElement): void {
    if (!picker) picker = createPicker(camera, dom);

    const track = (e: PointerEvent) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
    };
    window.addEventListener('pointermove', track);

    attachHover(dom, {
      pick: (x, y) => picker?.pick(x, y, corridor.frames) ?? null,
      onEnter: (f) => {
        hovered = f;
        f.setHover(true);
        deps.onHoverChange(true);
      },
      onLeave: (f) => {
        f.setHover(false);
        if (hovered === f) hovered = null;
        deps.onHoverChange(false);
      },
      isEnabled: () => interactive && !draggingLook && !store.get().detailProjectId,
    });

    attachDrag(dom, {
      threshold: 3,
      onDragStart: () => {
        draggingLook = true;
        dragStartLook = cameraRig.getLook();
        dragStartFov = cameraRig.getFov();
        if (hovered) hovered.setHover(false);
        deps.onHoverChange(false);
      },
      onDrag: (dx, dy) => {
        if (!interactive || store.get().detailProjectId) {
          cameraRig.setFov(dragStartFov + dy * 0.06);
          return;
        }
        cameraRig.setLook(
          dragStartLook.yaw - dx * YAW_SENSITIVITY,
          dragStartLook.pitch - dy * PITCH_SENSITIVITY,
        );
      },
      onDragEnd: () => {
        draggingLook = false;
      },
      onTap: () => {
        if (!interactive || !picker) return;
        const hit = picker.pick(pointerX, pointerY, corridor.frames);
        if (hit) {
          if (hit.index === activeIndex()) doOpen(hit.index);
          else goToIndex(hit.index);
        }
      },
    });

    attachWheel(dom, {
      onWheel: (sign) => {
        if (!interactive) {
          cameraRig.zoom(sign > 0 ? 2 : -2);
          return;
        }
        step(sign > 0 ? 1 : -1);
      },
    });

    attachGestures(dom, {
      onPinch: (deltaFov) => {
        cameraRig.zoom(deltaFov);
      },
      onPinchEnd: () => {},
    });
  }

  return {
    corridor,
    cameraRig,
    update,
    next: () => step(1),
    prev: () => step(-1),
    goToIndex,
    openActive,
    openProject,
    closeDetail,
    setInteractive: (e) => (interactive = e),
    setCursor: (v) => deps.onHoverChange(v),
    attach,
    activeIndex,
    dispose: () => {
      cameraRig.dispose();
      corridor.dispose();
    },
  };
}
