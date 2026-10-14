import { Raycaster, Vector2, type Camera, type Object3D } from 'three';
import type { FrameHandle } from '@/scene/frame';

export interface Picker {
  pick: (clientX: number, clientY: number, frames: FrameHandle[]) => FrameHandle | null;
  dispose: () => void;
}

export function createPicker(camera: Camera, domElement: HTMLElement): Picker {
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const rect = { left: 0, top: 0, width: 1, height: 1 };

  function updateRect(): void {
    const r = domElement.getBoundingClientRect();
    rect.left = r.left;
    rect.top = r.top;
    rect.width = r.width || 1;
    rect.height = r.height || 1;
  }

  return {
    pick(clientX, clientY, frames): FrameHandle | null {
      updateRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const candidates: Object3D[] = [];
      const map = new Map<Object3D, FrameHandle>();
      for (const frame of frames) {
        if (!frame.group.visible) continue;
        candidates.push(frame.hitMesh);
        map.set(frame.hitMesh, frame);
      }

      const hits = raycaster.intersectObjects(candidates, false);
      const first = hits[0];
      if (!first) return null;
      return map.get(first.object) ?? null;
    },
    dispose(): void {
      /* sin recursos persistentes */
    },
  };
}
