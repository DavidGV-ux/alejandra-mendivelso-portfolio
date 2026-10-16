import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Texture,
  Vector3,
} from 'three';
import { sceneConfig } from '@/config/scene.config';
import { theme } from '@/config/theme';
import { damp } from '@/utils/math';
import type { Project } from '@/types/project';
import type { ThemeMode } from '@/types/theme';

const { width: W, height: H } = sceneConfig.frame;

export interface FrameHandle {
  group: Group;
  project: Project;
  index: number;
  hitMesh: Mesh;
  setImage: (texture: Texture) => void;
  setActive: (active: boolean) => void;
  setHover: (hover: boolean) => void;
  setFocused: (focused: boolean) => void;
  /** Compatibilidad: sin marco, no hay tema que actualizar. */
  setTheme: (mode: Exclude<ThemeMode, 'auto'>) => void;
  /** True si escala, elevación y opacidades ya alcanzaron sus objetivos. */
  isSettled: () => boolean;
  update: (dt: number) => void;
  /** Posición de la etiqueta en mundo (para proyectar a pantalla si hiciera falta) */
  getWorldPosition: (out: Vector3) => Vector3;
  dispose: () => void;
}


function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export function createFrame(
  project: Project,
  index: number,
): FrameHandle {
  const accent = project.accent ?? theme.colors.accent;

  const group = new Group();
  group.userData.index = index;

  const imageMat = new MeshBasicMaterial({
    color: '#000000',
    transparent: true,
    toneMapped: true,
  });

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 256;
  glowCanvas.height = 256;
  const gctx = glowCanvas.getContext('2d')!;
  const grad = gctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, `rgba(${hexToRgb(accent)}, 0.55)`);
  grad.addColorStop(0.45, `rgba(${hexToRgb(accent)}, 0.22)`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 256, 256);
  const glowTexture = new CanvasTexture(glowCanvas);
  glowTexture.generateMipmaps = false;

  const glowMat = new MeshBasicMaterial({
    map: glowTexture,
    transparent: true,
    opacity: 0.9,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const imageGeometry = new PlaneGeometry(W, H);
  const image = new Mesh(imageGeometry, imageMat);
  image.position.z = 0.024;

  const glowGeometry = new PlaneGeometry(W * 1.7, H * 1.7);
  const glow = new Mesh(glowGeometry, glowMat);
  glow.position.z = 0.006;

  // Solo la imagen/video flota, con un brillo suave detrás.
  group.add(glow, image);

  // La hitbox coincide con la imagen para facilitar el clic.
  const hitGeometry = new PlaneGeometry(W, H);
  const hitMat = new MeshBasicMaterial({ visible: false });
  const hitMesh = new Mesh(hitGeometry, hitMat);
  group.add(hitMesh);

  const state = {
    active: false,
    hover: false,
    focused: false,
    scale: 1,
    lift: 0,
    imageAspect: W / H,
  };

  function targets(): { scale: number; lift: number; opacity: number } {
    return {
      scale: state.hover
        ? sceneConfig.frame.hoverScale
        : state.active
          ? sceneConfig.frame.activeScale
          : 1,
      lift: state.hover ? sceneConfig.frame.hoverLift : 0,
      opacity: state.focused
        ? 0
        : state.hover || state.active
          ? 1
          : sceneConfig.frame.inactiveOpacity,
    };
  }

  function update(dt: number): void {
    const { scale: targetScale, lift: targetLift, opacity: targetOpacity } = targets();

    state.scale = damp(state.scale, targetScale, 8, dt);
    state.lift = damp(state.lift, targetLift, 8, dt);
    group.scale.setScalar(state.scale);
    group.position.y = state.lift;

    const opacity = imageMat.opacity;
    const next = damp(opacity, targetOpacity, 10, dt);
    imageMat.opacity = next;
    glowMat.opacity = next * 0.22;

    group.visible = next > 0.01;
  }

  function isSettled(): boolean {
    const target = targets();
    return (
      Math.abs(state.scale - target.scale) < 0.002 &&
      Math.abs(state.lift - target.lift) < 0.002 &&
      Math.abs(imageMat.opacity - target.opacity) < 0.004
    );
  }

  return {
    group,
    project,
    index,
    hitMesh,
    setImage(texture: Texture): void {
      const source = texture.image as HTMLVideoElement | HTMLImageElement | ImageBitmap | undefined;
      let w: number | undefined;
      let h: number | undefined;
      if (source instanceof HTMLVideoElement) {
        w = source.videoWidth;
        h = source.videoHeight;
      } else if (source) {
        w = source.width;
        h = source.height;
      }
      if (w && h) {
        state.imageAspect = w / h;
        const frameAspect = W / H;
        if (state.imageAspect > frameAspect) {
          image.scale.set(1, frameAspect / state.imageAspect, 1);
        } else {
          image.scale.set(state.imageAspect / frameAspect, 1, 1);
        }
      }
      imageMat.map = texture;
      imageMat.color.setRGB(1, 1, 1);
      imageMat.needsUpdate = true;
      texture.needsUpdate = true;

      // Saltamos directamente a la opacidad objetivo para evitar que se vea negro.
      imageMat.opacity = targets().opacity;
    },
    setActive: (active) => {
      state.active = active;
    },
    setHover: (hover) => {
      state.hover = hover;
    },
    setFocused: (focused) => {
      state.focused = focused;
    },
    setTheme: () => {},
    isSettled,
    update,
    getWorldPosition: (out) => group.getWorldPosition(out),
    dispose(): void {
      imageGeometry.dispose();
      glowGeometry.dispose();
      hitGeometry.dispose();
      imageMat.dispose();
      glowMat.dispose();
      glowTexture.dispose();
      hitMat.dispose();
      group.clear();
    },
  };
}
