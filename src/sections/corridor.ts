import type { PerspectiveCamera } from 'three';
import { Raycaster, Vector2 } from 'three';
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
import type { Texture } from 'three';
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
  /** Tarjeta final: texto e imagen de cierre. */
  endCard: { title: string; subtitle: string; photo: string };
  /** Al pulsar la pantalla final se navega a Acerca de mí. */
  onOpenAbout: () => void;
}

function coverVideoUrl(project: Project, mode: 'light' | 'dark'): string | null {
  const cv = project.coverVideo;
  if (!cv) return null;
  if (typeof cv === 'string') return cv;
  return mode === 'light' ? cv.light ?? cv.dark ?? null : cv.dark ?? cv.light ?? null;
}

export function createCorridorController(deps: Deps): CorridorController {
  const { camera, caps, quality, loader, projects, store } = deps;
  const total = projects.length;
  const reducedMotion = caps.prefersReducedMotion;

  const corridor = createCorridor(projects, caps);
  const cameraRig = createCameraFreeLook(camera);
  const endScreen = createEndScreen();
  endScreen.group.position.set(0, 0, endScreenZ(total, corridor.layout));
  corridor.group.add(endScreen.group);
  let picker: ReturnType<typeof createPicker> | null = null;
  const endRaycaster = new Raycaster();
  const endPointer = new Vector2();

  let currentTheme: 'light' | 'dark' = deps.theme;

  let progress = 0;
  let target = 0;
  let interactive = true;
  let draggingLook = false;
  let selected = false;
  let lastDragEndAt = 0;
  let attached = false;
  let lastActiveIdx = -1;
  let hovered: FrameHandle | null = null;
  let hoverSerial = 0;
  let endHovering = false;
  let dragStartLook = { yaw: 0, pitch: 0 };
  let dragStartFov = 0;
  const cleanups: Array<() => void> = [];

  const loaded = new Set<string>();
  const loading = new Set<string>();
  /** Texturas estáticas (covers/pósters), incluido Salvando Patitas, para volver a ellas. */
  const posterTextures = new Map<string, Texture>();
  /** Videos de cover por proyecto y tema (`${id}:${mode}`). */
  const coverVideos = new Map<string, CoverVideoHandle>();
  const videoLoading = new Set<string>();
  let endCardPhoto: HTMLImageElement | null = null;

  function videoKey(id: string, mode: 'light' | 'dark'): string {
    return `${id}:${mode}`;
  }

  /** Vista previa ligera: el video solo se reproduce al hacer hover; al cerrar, se pausa. */
  function updateVideoPlayback(): void {
    if (hovered) {
      const hoveredIdx = (hovered as { index: number }).index;
      for (const [key, handle] of coverVideos) {
        const [id] = key.split(':');
        const frameIdx = projects.findIndex((p) => p.id === id);
        handle.setPlaying(frameIdx === hoveredIdx);
      }
    } else {
      for (const handle of coverVideos.values()) {
        handle.setPlaying(false);
      }
    }
  }

  function clampTarget(v: number): number {
    if (total <= 0) return 0;
    return Math.max(0, Math.min(total - 1, v));
  }

  function activeIndex(): number {
    return Math.round(progress);
  }

  function travelZFor(index: number): number {
    const pairCount = Math.ceil(total / 2);
    const center = ((pairCount - 1) / 2) * corridor.layout.spacing;
    return Math.floor(index / 2) * corridor.layout.spacing - center;
  }
  function loadAround(index: number): void {
    const indices = new Set([index - 3, index - 2, index - 1, index, index + 1, index + 2, index + 3]);
    for (const i of indices) {
      if (i < 0 || i >= total) continue;
      const p = projects[i];
      const f = corridor.frames[i];
      if (!p || !f) continue;

      if (loaded.has(p.id) || loading.has(p.id)) continue;

      loading.add(p.id);
      loader
        .loadTexture(p.cover, quality.textureMax, quality.anisotropy)
        .then((t) => {
          posterTextures.set(p.id, t);
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
    if (idx !== lastActiveIdx) {
      lastActiveIdx = idx;
      updateVideoPlayback();
    }
    corridor.setActiveIndex(idx);
    corridor.update(dt);
    if (endScreen.update(dt)) deps.invalidate();
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
          const serial = ++hoverSerial;
          const project = projects[f.index];
          const videoUrl = project ? coverVideoUrl(project, currentTheme) : null;
          // Dwell de 200 ms antes de cargar/reproducir el video (evita trabajo al pasar de lado).
          window.setTimeout(() => {
            if (!videoUrl || serial !== hoverSerial || hovered !== f || !project) return;
            const key = videoKey(project.id, currentTheme);
            let video = coverVideos.get(key);
            if (!video) {
              if (videoLoading.has(key)) return;
              videoLoading.add(key);
              video = createCoverVideo(videoUrl, () => deps.invalidate());
              coverVideos.set(key, video);
              void video.ready
                .then(() => {
                  if (hovered !== f) return; // Si salió antes, no cambiamos a video.
                  f.setImage(video!.texture);
                  video!.setPlaying(true);
                  deps.invalidate();
                })
                .catch(() => {})
                .finally(() => videoLoading.delete(key));
            } else if (video.isReady()) {
              f.setImage(video.texture);
              updateVideoPlayback();
              deps.invalidate();
            }
          }, 200);
          deps.invalidate();
          deps.onHoverChange(true);
        },
onLeave: (f) => {
          if (hovered === f) hovered = null;
          hoverSerial++; // cancela cualquier carga pendiente por dwell
          f.setHover(false);
          const project = projects[f.index];
          if (project) {
            const key = videoKey(project.id, currentTheme);
            const video = coverVideos.get(key);
            if (video) video.setPlaying(false);
            const poster = posterTextures.get(project.id);
            if (poster) {
              f.setImage(poster);
            } else {
              // fallback si la portada no se había terminado de cargar
              loader
                .loadTexture(project.cover, quality.textureMax, quality.anisotropy)
                .then((t) => {
                  if (hovered === f) return;
                  posterTextures.set(project.id, t);
                  f.setImage(t);
                  deps.invalidate();
                })
                .catch(() => {});
            }
          }
          updateVideoPlayback();
          deps.invalidate();
          deps.onHoverChange(false);
        },
        isEnabled: () => interactive && !draggingLook && !store.get().detailProjectId,
      }),
    );

    // Hover sobre la tarjeta final: mueve letras e imagen (parallax).
    const onEndPointerMove = (event: PointerEvent): void => {
      if (!interactive || draggingLook || store.get().detailProjectId) {
        if (endHovering) {
          endHovering = false;
          endScreen.setHover(0, 0, false);
          deps.invalidate();
        }
        return;
      }
      const rect = dom.getBoundingClientRect();
      endPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      endPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      endRaycaster.setFromCamera(endPointer, deps.camera);
      const hit = endRaycaster.intersectObject(endScreen.hitMesh)[0];
      if (hit?.uv) {
        if (!endHovering) {
          endHovering = true;
          deps.onHoverChange(true);
        }
        endScreen.setHover(hit.uv.x * 2 - 1, hit.uv.y * 2 - 1, true);
        deps.invalidate();
      } else if (endHovering) {
        endHovering = false;
        endScreen.setHover(0, 0, false);
        deps.onHoverChange(false);
        deps.invalidate();
      }
    };
    dom.addEventListener('pointermove', onEndPointerMove);
    cleanups.push(() => dom.removeEventListener('pointermove', onEndPointerMove));

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
          if (hit) {
            doSelect(hit.index);
            return;
          }
          // ¿Pulsó la pantalla final?
          const rect = dom.getBoundingClientRect();
          endPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          endPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          endRaycaster.setFromCamera(endPointer, deps.camera);
          if (endRaycaster.intersectObject(endScreen.hitMesh).length > 0) {
            deps.onOpenAbout();
          }
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

  function loadPhoto(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function loadEndScreen(): void {
    const render = (photo: HTMLImageElement | null) => {
      endScreen.renderCard(photo, deps.endCard.title, deps.endCard.subtitle, currentTheme);
      deps.invalidate();
    };
    if (endCardPhoto) {
      render(endCardPhoto);
      return;
    }
    const url = deps.endCard.photo;
    if (!url) {
      render(null);
      return;
    }
    void loadPhoto(url).then((img) => {
      endCardPhoto = img;
      render(img);
    });
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
      if (mode === currentTheme) {
        corridor.frames.forEach((frame) => frame.setTheme(mode));
        deps.invalidate();
        return;
      }
      currentTheme = mode;
      corridor.frames.forEach((frame) => frame.setTheme(mode));
      // Descarta los videos del tema anterior y recarga con el tema nuevo.
      for (const [key, handle] of coverVideos) {
        const [id, themeMode] = key.split(':');
        if (themeMode !== mode && id) {
          handle.dispose();
          coverVideos.delete(key);
          const project = projects.find((p) => p.id === id);
          if (project) loaded.delete(project.id);
        }
      }
      loadEndScreen();
      loadAround(activeIndex());
      deps.invalidate();
    },
    isSettled: () =>
      Math.abs(target - progress) < 0.001 &&
      cameraRig.isSettled() &&
      corridor.frames.every((frame) => frame.isSettled()),
    preload: () => {
      loadAround(activeIndex());
      updateVideoPlayback();
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
