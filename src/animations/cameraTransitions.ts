import { Vector3, type PerspectiveCamera } from 'three';
import { gsap } from 'gsap';
import { sceneConfig } from '@/config/scene.config';
import { theme } from '@/config/theme';
import {
  cameraPose,
  framePosition,
  type CameraPose,
  type LayoutConfig,
} from '@/scene/layout';

export interface CameraRig {
  /** Coloca la cámara siguiendo la hélice de forma continua (index puede ser decimal). */
  setProgress: (progress: number) => void;
  getProgress: () => number;
  /** Acerca la cámara al marco activo (vista de detalle). */
  focus: (index: number, immediate?: boolean) => void;
  /** Vuelve a la órbita de la hélice. */
  release: (progress: number, immediate?: boolean) => void;
  isFocused: () => boolean;
  update: () => void;
  dispose: () => void;
}

export function createCameraRig(
  camera: PerspectiveCamera,
  layout: LayoutConfig,
  total: number,
  reducedMotion: boolean,
): CameraRig {
  let progress = 0;
  let override = false;

  const current: CameraPose = { position: new Vector3(), target: new Vector3() };
  const scratch: CameraPose = { position: new Vector3(), target: new Vector3() };
  const scratch2: CameraPose = { position: new Vector3(), target: new Vector3() };
  const lookAt = new Vector3();
  const tweens: gsap.core.Tween[] = [];

  function poseAt(index: number, out: CameraPose = scratch): CameraPose {
    return cameraPose(index, total, layout, out);
  }

  function detailPose(index: number, out: CameraPose): CameraPose {
    const base = poseAt(index, out);
    const frame = framePosition(index, total, layout, new Vector3());
    const dir = base.position.clone().sub(frame).normalize();
    const distance = Math.max(
      base.position.distanceTo(frame) - sceneConfig.camera.focusPush,
      1.6,
    );
    base.position.copy(frame).add(dir.clone().multiplyScalar(distance));
    base.target.copy(frame);
    if (!layout.compact) {
      const right = new Vector3().crossVectors(new Vector3(0, 1, 0), dir).normalize();
      right.multiplyScalar(0.7);
      base.position.add(right);
      base.target.add(right);
    }
    return base;
  }

  function apply(): void {
    camera.position.copy(current.position);
    lookAt.copy(current.target);
    camera.lookAt(lookAt);
  }

  function killTweens(): void {
    tweens.forEach((t) => t.kill());
    tweens.length = 0;
  }

  function tweenTo(target: CameraPose, duration: number): void {
    killTweens();
    const d = reducedMotion ? 0 : duration;
    tweens.push(
      gsap.to(current.position, {
        x: target.position.x,
        y: target.position.y,
        z: target.position.z,
        duration: d,
        ease: 'power3.out',
        overwrite: true,
      }),
      gsap.to(current.target, {
        x: target.target.x,
        y: target.target.y,
        z: target.target.z,
        duration: d,
        ease: 'power3.out',
        overwrite: true,
      }),
    );
  }

  poseAt(0, current);
  apply();

  return {
    setProgress(next: number): void {
      progress = next;
      if (override) return;
      poseAt(next, current);
      apply();
    },
    getProgress: () => progress,
    focus(index: number, immediate = false): void {
      override = true;
      detailPose(index, scratch2);
      if (immediate) {
        current.position.copy(scratch2.position);
        current.target.copy(scratch2.target);
        apply();
      } else {
        tweenTo(scratch2, theme.cameraTransition * 1.05);
      }
    },
    release(next: number, immediate = false): void {
      progress = next;
      override = false;
      poseAt(next, scratch2);
      if (immediate) {
        current.position.copy(scratch2.position);
        current.target.copy(scratch2.target);
        apply();
      } else {
        tweenTo(scratch2, theme.cameraTransition * 0.9);
      }
    },
    isFocused: () => override,
    update: apply,
    dispose(): void {
      killTweens();
    },
  };
}
