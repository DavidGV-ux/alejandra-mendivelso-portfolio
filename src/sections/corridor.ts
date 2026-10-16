import type { PerspectiveCamera } from 'three';
import { createCorridor, endScreenZ, type Corridor } from '@/scene/corridor';
import { createEndScreen } from '@/scene/endScreen';
import { createCoverVideo, type CoverVideoHandle } from '@/scene/coverVideo';
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
import { sceneConfig } from '@/config/scene.config';
import type { FrameHandle } from '@/scene/frame';
import type { Project } from '@/types/project';
import type { Capabilities, ThemeMode } from '@/types/theme';
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
  /** Centra el proyecto activo sin abrir su detalle. */
  selectActive: () => void;
  /** True si hay un proyecto centrado esperando apertura. */
  isSelected: () => boolean;
  /** Suelta el enfoque de selección y vuelve a la vista de pasillo. */
  releaseSelection: () => void;
  openActive: () => void;
  openProject: (id: string) => void;
  closeDetail: (immediate?: boolean) => void;
  setInteractive: (enabled: boolean) => void;
  setCursor: (interactive: boolean) => void;
  /** Ajusta los marcos vivos al modo día/noche. */
  setTheme: (mode: Exclude<ThemeMode, 'auto'>) => void;
  /** True si cámara y marcos ya están en reposo (sin animaciones pendientes). */
  isSettled: () => boolean;
  /** Carga los covers alrededor del índice activo (para la pantalla de carga). */
  preload: () => void;
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
  theme: Exclude<ThemeMode, 'auto'>;
  onOpenDetail: (id: string) => void;
  onCloseDetail: () => void;
  onHoverChange: (hovering: boolean) => void;
  /** Despierta el loop de render bajo demanda. */
  invalidate: () => void;
}

export function createCorridorController(deps: Deps): CorridorController {
  const { camera, caps, quality, loader, projects, store } = deps;
  const total = projects.length;
  const reducedMotion = caps.prefersReducedMotion;

  const corridor = createCorridor(projects, caps, deps.theme);
  const cameraRig = createCameraFreeLook(camera);
  const endScreen = createEndScreen();
  endScreen.group.position.set(0, 0, endScreenZ(total, corridor.layout));
  corridor.group.add(endScreen.group);
  let picker: ReturnType<typeof createPicker> | null = null;

  let progress = 0;
  let target = 0;
  let interactive = true;
  let draggingLook = false;
  let selected = false;
  let lastDragEndAt = 0;
  let attached = false;
  let hovered: FrameHandle | null = null;
  let dragStartLook = { yaw: 0, pitch: 0 };
  let dragStartFov = 0;
  const cleanups: Array<() => void> = [];

  const loaded = new Set<string>();
  const loading = new Set<string>();
  const coverVideos = new Map<string, CoverVideoHandle>();

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
      if (loaded.has(p.id) || loading.has(p.id) || coverVideos.has(p.id)) continue;

      if (p.coverVideo && !reducedMotion) {
        // Póster inmediato y video en bucle en cuanto tenga datos.
        const video = createCoverVideo(p.coverVideo, () => deps.invalidate());
        coverVideos.set(p.id, video);
        loading.add(p.id);
        loader
          .loadTexture(p.cover, quality.textureMax, quality.anisotropy)
          .then((t) => {
            if (!video.isReady()) {
              f.setImage(t);
              deps.invalidate();
            }
          })
          .catch(() => {})
          .finally(() => loading.delete(p.id));
        video.ready
          .then(() => {
            f.setImage(video.texture);
            loaded.add(p.id);
            deps.invalidate();
          })
          .catch(() => {
            loaded.add(p.id);
          });
        continue;
      }

      loading.add(p.id);
      loader
        .loadTexture(p.cover, quality.textureMax, quality.anisotropy)
        .then((t) => {
          f.setImage(t);
          loaded.add(p.id);
          deps.invalidate();
        })
        .catch(() => {})
        .finally(() => loading.delete(p.id));
    }
  }

  function applyFocusOpacity(focused: number | null): void {
    corridor.frames.forEach((f) => f.setFocused(focused !== null && f.index !== focused));
  }

  function releaseSelection(): void {
    if (!selected) return;
    selected = false;
    cameraRig.release();
    deps.invalidate();
  }

  function step(delta: number): void {
    if (!interactive) return;
    releaseSelection();
    target = clampTarget(target + delta);
    if (reducedMotion) progress = target;
    deps.invalidate();
  }

  function goToIndex(i: number): void {
    releaseSelection();
    target = clampTarget(i);
    if (reducedMotion) progress = target;
    deps.invalidate();
  }

  function doSelect(i: number): void {
    const p = projects[i];
    if (!p) return;
    target = clampTarget(i);
    if (reducedMotion) progress = target;
    cameraRig.focusOn(i, total, corridor.layout, {
      duration: reducedMotion ? 0 : 0.62,
      frontal: true,
    });
    selected = true;
    deps.invalidate();
  }

  function selectActive(): void {
    if (!interactive) return;
    doSelect(activeIndex());
  }

  function doOpen(i: number): void {
    const p = projects[i];
    if (!p) return;
    const keepFrontal = selected;
    cameraRig.focusOn(i, total, corridor.layout, {
      duration: reducedMotion ? 0 : 0.62,
      frontal: keepFrontal,
    });
    applyFocusOpacity(i);
    selected = false;
    interactive = false;
    deps.invalidate();
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
    selected = false;
    void immediate;
    interactive = true;
    deps.invalidate();
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
    const idx = activeIndex();
    corridor.setActiveIndex(idx);
    corridor.update(dt);
    loadAround(idx);
    if (store.get().activeIndex !== idx) store.set({ activeIndex: idx });
  }

  function attach(dom: HTMLElement): void {
    if (attached) return;
    attached = true;
    if (!picker) picker = createPicker(camera, dom);

    cleanups.push(
      attachHover(dom, {
        pick: (x, y) => picker?.pick(x, y, corridor.frames) ?? null,
        onEnter: (f) => {
          hovered = f;
          f.setHover(true);
          deps.invalidate();
          deps.onHoverChange(true);
        },
        onLeave: (f) => {
          f.setHover(false);
          if (hovered === f) hovered = null;
          deps.invalidate();
          deps.onHoverChange(false);
        },
        isEnabled: () => interactive && !draggingLook && !store.get().detailProjectId,
      }),
    );

    cleanups.push(
      attachDrag(dom, {
        threshold: sceneConfig.controls.dragThreshold,
        onDragStart: () => {
          draggingLook = true;
          if (selected && !store.get().detailProjectId) releaseSelection();
          dragStartLook = cameraRig.getLook();
          dragStartFov = cameraRig.getFov();
          if (hovered) hovered.setHover(false);
          deps.invalidate();
          deps.onHoverChange(false);
        },
        onDrag: (dx, dy) => {
          if (!interactive || store.get().detailProjectId) {
            cameraRig.setFov(dragStartFov + dy * 0.06);
          } else {
            cameraRig.setLook(
              dragStartLook.yaw - dx * YAW_SENSITIVITY,
              dragStartLook.pitch - dy * PITCH_SENSITIVITY,
            );
          }
          deps.invalidate();
        },
        onDragEnd: () => {
          draggingLook = false;
          lastDragEndAt = performance.now();
        },
        onTap: (event: PointerEvent) => {
          if (!interactive || !picker || store.get().detailProjectId) return;
          const hit = picker.pick(event.clientX, event.clientY, corridor.frames);
          if (hit) doSelect(hit.index);
        },
      }),
    );

    cleanups.push(
      attachWheel(dom, {
        onWheel: (sign) => {
          if (!interactive) cameraRig.zoom(sign > 0 ? 2 : -2);
          else step(sign > 0 ? 1 : -1);
          deps.invalidate();
        },
      }),
    );

    cleanups.push(
      attachGestures(dom, {
        onPinch: (deltaFov) => {
          cameraRig.zoom(deltaFov);
          deps.invalidate();
        },
        onPinchEnd: () => {},
      }),
    );

    const onDoubleClick = (event: MouseEvent): void => {
      if (!interactive || !picker || store.get().detailProjectId) return;
      if (performance.now() - lastDragEndAt < 400) return;
      const hit = picker.pick(event.clientX, event.clientY, corridor.frames);
      if (hit) doOpen(hit.index);
    };
    dom.addEventListener('dblclick', onDoubleClick);
    cleanups.push(() => dom.removeEventListener('dblclick', onDoubleClick));
  }

  function loadEndScreen(): void {
    const project = projects.find((p) => p.id === 'umbra') ?? projects[0];
    if (!project) return;
    loader
      .loadTexture(project.cover, quality.textureMax, quality.anisotropy)
      .then((t) => {
        endScreen.setImage(t);
        deps.invalidate();
      })
      .catch(() => {});
  }

  return {
    corridor,
    cameraRig,
    update,
    next: () => step(1),
    prev: () => step(-1),
    goToIndex,
    selectActive,
    isSelected: () => selected,
    releaseSelection,
    openActive,
    openProject,
    closeDetail,
    setInteractive: (e) => (interactive = e),
    setCursor: (v) => deps.onHoverChange(v),
    setTheme: (mode) => {
      corridor.frames.forEach((frame) => frame.setTheme(mode));
      deps.invalidate();
    },
    isSettled: () =>
      Math.abs(target - progress) < 0.001 &&
      cameraRig.isSettled() &&
      corridor.frames.every((frame) => frame.isSettled()),
    preload: () => {
      loadAround(activeIndex());
      loadEndScreen();
    },
    attach,
    activeIndex,
    dispose: () => {
      cleanups.forEach((dispose) => dispose());
      cleanups.length = 0;
      picker?.dispose();
      cameraRig.dispose();
      coverVideos.forEach((v) => v.dispose());
      coverVideos.clear();
      endScreen.dispose();
      corridor.dispose();
    },
  };
}
