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
  /** Índice del proyecto centrado (seleccionado) o null si la vista es libre. */
  let selectedIndex: number | null = null;
  /** Índice cuyo video de vista previa debe reproducirse (hover o selección). */
  let previewIndex: number | null = null;
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

  /** Vista previa ligera: solo el proyecto activo (hover o selección) reproduce su video. */
  function updateVideoPlayback(): void {
    for (const [key, handle] of coverVideos) {
      const [id] = key.split(':');
      const frameIdx = projects.findIndex((p) => p.id === id);
      handle.setPlaying(frameIdx === previewIndex);
    }
  }

  /**
   * Carga (si hace falta) la vista previa del proyecto y la muestra en su marco
   * cuando sigue siendo el activo. Sirve tanto para el hover del ratón como
   * para la selección por toque, de modo que en móvil también se ve la animación.
   */
  function requestPreview(index: number): void {
    const project = projects[index];
    const frame = corridor.frames[index];
    if (!project || !frame) return;
    const videoUrl = coverVideoUrl(project, currentTheme);
    if (!videoUrl) return;

    const key = videoKey(project.id, currentTheme);
    const existing = coverVideos.get(key);
    if (existing) {
      if (existing.isReady()) {
        frame.setImage(existing.texture);
        updateVideoPlayback();
        deps.invalidate();
      }
      return;
    }
    if (videoLoading.has(key)) return;

    videoLoading.add(key);
    const video = createCoverVideo(videoUrl, () => deps.invalidate());
    coverVideos.set(key, video);
    void video.ready
      .then(() => {
        if (previewIndex !== index) return;
        frame.setImage(video.texture);
        updateVideoPlayback();
        deps.invalidate();
      })
      .catch(() => {})
      .finally(() => videoLoading.delete(key));
  }

  /** Devuelve el marco a su portada estática y pausa su video. */
  function restorePreview(index: number): void {
    const project = projects[index];
    const frame = corridor.frames[index];
    if (!project || !frame) return;
    const video = coverVideos.get(videoKey(project.id, currentTheme));
    if (video) video.setPlaying(false);
    const poster = posterTextures.get(project.id);
    if (poster) {
      frame.setImage(poster);
      deps.invalidate();
      return;
    }
    // La portada aún no se había terminado de cargar: se recupera.
    loader
      .loadTexture(project.cover, quality.textureMax, quality.anisotropy)
      .then((t) => {
        posterTextures.set(project.id, t);
        frame.setImage(t);
        deps.invalidate();
      })
      .catch(() => {});
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
    return Math.floor(index / 2) * corridor.layout.spacing - center + corridor.layout.spacing * 2.5;
  }
  function loadAround(index: number): void {
    // Si hay pocos proyectos, los cargamos todos de golpe para evitar marcos negros al fondo.
    const range = total < 10 ? total : 4;
    const indices = new Set<number>();
    if (total < 10) {
      for (let i = 0; i < total; i++) indices.add(i);
    } else {
      for (let i = index - range; i <= index + range; i++) indices.add(i);
    }

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

    // Limpieza de videos lejanos para ahorrar memoria y CPU.
    const videoRange = 2;
    for (const [key, handle] of coverVideos) {
      const [id] = key.split(':');
      const idx = projects.findIndex((p) => p.id === id);
      if (idx !== -1 && Math.abs(idx - index) > videoRange && idx !== previewIndex) {
        handle.dispose();
        coverVideos.delete(key);
      }
    }
  }

  function applyFocusOpacity(focused: number | null): void {
    corridor.frames.forEach((f) => f.setFocused(focused !== null && f.index !== focused));
  }

  function releaseSelection(): void {
    if (selectedIndex === null) return;
    const idx = selectedIndex;
    selectedIndex = null;
    const stillHovered = hovered !== null && (hovered as { index: number }).index === idx;
    if (!stillHovered) {
      if (previewIndex === idx) previewIndex = null;
      restorePreview(idx);
      updateVideoPlayback();
    }
    cameraRig.release();
    deps.invalidate();
  }

  /** Movimiento continuo del pasillo (rueda): avanza sin fijar ningún marco. */
  function step(delta: number): void {
    if (!interactive) return;
    releaseSelection();
    target = clampTarget(target + delta);
    if (reducedMotion) progress = target;
    deps.invalidate();
  }

  /** Navegación por proyectos (flechas de la barra y del teclado): deja el
   *  proyecto destino justo enfrente de la cámara. */
  function focusStep(delta: number): void {
    if (!interactive) return;
    doSelect(clampTarget(Math.round(target) + delta));
  }

  function goToIndex(i: number): void {
    if (!interactive) return;
    doSelect(clampTarget(i));
  }

  function doSelect(i: number): void {
    const p = projects[i];
    if (!p) return;
    if (previewIndex !== null && previewIndex !== i) restorePreview(previewIndex);
    target = clampTarget(i);
    if (reducedMotion) progress = target;
    cameraRig.focusOn(i, total, corridor.layout, {
      duration: reducedMotion ? 0 : 0.62,
      frontal: true,
    });
    selectedIndex = i;
    previewIndex = i;
    requestPreview(i);
    deps.invalidate();
  }

  function selectActive(): void {
    if (!interactive) return;
    doSelect(activeIndex());
  }

  function doOpen(i: number): void {
    const p = projects[i];
    if (!p) return;
    const keepFrontal = selectedIndex !== null;
    cameraRig.focusOn(i, total, corridor.layout, {
      duration: reducedMotion ? 0 : 0.62,
      frontal: keepFrontal,
    });
    applyFocusOpacity(i);
    selectedIndex = null;
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
    selectedIndex = null;
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

    // Solo actualizamos la tarjeta final si estamos muy cerca o está siendo interactuada.
    // Esto previene el lag al inicio y durante la navegación por los primeros proyectos.
    const distToEnd = Math.abs(camera.position.z - endScreen.group.position.z);
    const isVisible = distToEnd < 15;
    if (isVisible && endScreen.update(dt)) {
      deps.invalidate();
    }

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
            previewIndex = f.index;
            requestPreview(f.index);
          }, 200);
          deps.invalidate();
          deps.onHoverChange(true);
        },
        onLeave: (f) => {
          if (hovered === f) hovered = null;
          hoverSerial++; // cancela cualquier carga pendiente por dwell
          f.setHover(false);
          // Si el marco quedó fijado por selección (toque), conserva su vista previa.
          if (selectedIndex !== f.index) {
            if (previewIndex === f.index) previewIndex = null;
            restorePreview(f.index);
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
        const nx = hit.uv.x * 2 - 1;
        const ny = hit.uv.y * 2 - 1;
        if (!endHovering) {
          endHovering = true;
          deps.onHoverChange(true);
        }
        endScreen.setHover(nx, ny, true);
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
          if (selectedIndex !== null && !store.get().detailProjectId) releaseSelection();
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

    const onKeyDown = (e: KeyboardEvent): void => {
      if (!interactive || store.get().detailProjectId) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          focusStep(1);
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          focusStep(-1);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    cleanups.push(() => {
      window.removeEventListener('keydown', onKeyDown);
    });
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
    next: () => focusStep(1),
    prev: () => focusStep(-1),
    goToIndex,
    selectActive,
    isSelected: () => selectedIndex !== null,
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
      endScreen.isSettled() &&
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
