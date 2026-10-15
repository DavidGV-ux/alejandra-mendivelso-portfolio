import { PerspectiveCamera } from 'three';
import { sceneConfig } from '@/config/scene.config';
import type { CorridorLayout } from '@/scene/corridor';

export function createCamera(layout: CorridorLayout): PerspectiveCamera {
  const fov = layout.compact ? sceneConfig.camera.fov + 8 : sceneConfig.camera.fov;
  const camera = new PerspectiveCamera(
    fov,
    window.innerWidth / window.innerHeight,
    sceneConfig.camera.near,
    sceneConfig.camera.far,
  );
  camera.position.set(0, 0.15, 0);
  return camera;
}
