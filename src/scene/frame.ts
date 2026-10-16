import {
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Texture,
  Vector3,
} from 'three';
import { sceneConfig } from '@/config/scene.config';
import { theme } from '@/config/theme';
import { damp } from '@/utils/math';
import type { Project } from '@/types/project';
import { createLabel, type LabelHandle } from './label';

const { width: W, height: H } = sceneConfig.frame;
const BORDER = 0.03;
const MAT = 0.14;

export interface FrameHandle {
  group: Group;
  project: Project;
  index: number;
  hitMesh: Mesh;
  setImage: (texture: Texture) => void;
  setActive: (active: boolean) => void;
  setHover: (hover: boolean) => void;
  setFocused: (focused: boolean) => void;
  /** True si escala, elevación y opacidades ya alcanzaron sus objetivos. */
  isSettled: () => boolean;
  update: (dt: number) => void;
  /** Posición de la etiqueta en mundo (para proyectar a pantalla si hiciera falta) */
  getWorldPosition: (out: Vector3) => Vector3;
  dispose: () => void;
}

export function createFrame(project: Project, index: number): FrameHandle {
  const accent = project.accent ?? theme.colors.accent;

  const group = new Group();
  group.userData.index = index;

  const borderMat = new MeshStandardMaterial({
    color: theme.colors.frameBorder,
    roughness: 0.9,
    metalness: 0,
    transparent: true,
  });
  const matMat = new MeshStandardMaterial({
    color: theme.colors.frame,
    roughness: 0.95,
    metalness: 0,
    transparent: true,
  });
  const imageMat = new MeshBasicMaterial({
    color: theme.colors.textFaint,
    transparent: true,
    toneMapped: true,
  });
  const lineMat = new MeshBasicMaterial({ color: accent, transparent: true });

  const border = new Mesh(new PlaneGeometry(W + 2 * MAT + 2 * BORDER, H + 2 * MAT + 2 * BORDER), borderMat);
  border.position.z = 0;

  const mat = new Mesh(new PlaneGeometry(W + 2 * MAT, H + 2 * MAT), matMat);
  mat.position.z = 0.012;

  const imageGeometry = new PlaneGeometry(W, H);
  const image = new Mesh(imageGeometry, imageMat);
  image.position.z = 0.024;

  const line = new Mesh(new PlaneGeometry(0.016, 0.22), lineMat);
  line.position.set(0, H / 2 + MAT + 0.11, 0.02);

  const metaLabel: LabelHandle = createLabel({
    text: `${project.category} / ${project.year}`.toUpperCase(),
    fontFamily: theme.fonts.meta,
    fontSize: 20,
    weight: '700',
    color: '#f8f6f2',
    background: 'rgba(16, 16, 20, 0.72)',
    worldHeight: 0.16,
    letterSpacing: 3.6,
  });
  metaLabel.sprite.position.set(0, H / 2 + MAT + 0.36, 0.03);

  const titleLabel: LabelHandle = createLabel({
    text: project.title,
    fontFamily: theme.fonts.display,
    fontSize: 36,
    weight: '600',
    color: '#f8f6f2',
    background: 'rgba(16, 16, 20, 0.7)',
    accent,
    worldHeight: 0.28,
    letterSpacing: -2.5,
  });
  titleLabel.sprite.position.set(0, H / 2 + MAT + 0.68, 0.03);

  group.add(border, mat, image, line, metaLabel.sprite, titleLabel.sprite);

  // La hitbox coincide con el marco completo para facilitar el clic.
  const hitGeometry = new PlaneGeometry(W + 2 * MAT, H + 2 * MAT + 0.9);
  const hitMat = new MeshBasicMaterial({ visible: false });
  const hitMesh = new Mesh(hitGeometry, hitMat);
  hitMesh.position.set(0, 0.35, 0.05);
  group.add(hitMesh);

  const state = {
    active: false,
    hover: false,
    focused: false,
    scale: 1,
    lift: 0,
    imageAspect: W / H,
  };

  titleLabel.setOpacity(0);

  function targets(): { scale: number; lift: number; opacity: number; title: number } {
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
      title: state.hover || state.active ? 1 : 0,
    };
  }

  function update(dt: number): void {
    const { scale: targetScale, lift: targetLift, opacity: targetOpacity, title: titleTarget } =
      targets();

    state.scale = damp(state.scale, targetScale, 8, dt);
    state.lift = damp(state.lift, targetLift, 8, dt);
    group.scale.setScalar(state.scale);
    group.position.y = state.lift;

    const opacity = imageMat.opacity;
    const next = damp(opacity, targetOpacity, 10, dt);
    borderMat.opacity = next;
    matMat.opacity = next;
    imageMat.opacity = next;
    lineMat.opacity = next;

    const metaTarget = state.focused ? 0 : next;
    const titleOpacity = damp(titleLabel.sprite.material.opacity, titleTarget, 10, dt);
    titleLabel.setOpacity(titleOpacity * (state.focused ? 0 : 1));
    metaLabel.setOpacity(metaTarget);
    lineMat.opacity = next * 0.9;

    group.visible = next > 0.01;
  }

  function isSettled(): boolean {
    const target = targets();
    return (
      Math.abs(state.scale - target.scale) < 0.002 &&
      Math.abs(state.lift - target.lift) < 0.002 &&
      Math.abs(imageMat.opacity - target.opacity) < 0.004 &&
      Math.abs(titleLabel.sprite.material.opacity - target.title) < 0.004
    );
  }

  return {
    group,
    project,
    index,
    hitMesh,
    setImage(texture: Texture): void {
      const w = texture.image?.width;
      const h = texture.image?.height;
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
    isSettled,
    update,
    getWorldPosition: (out) => group.getWorldPosition(out),
    dispose(): void {
      border.geometry.dispose();
      mat.geometry.dispose();
      imageGeometry.dispose();
      line.geometry.dispose();
      hitGeometry.dispose();
      borderMat.dispose();
      matMat.dispose();
      imageMat.dispose();
      lineMat.dispose();
      hitMat.dispose();
      metaLabel.dispose();
      titleLabel.dispose();
      group.clear();
    },
  };
}
