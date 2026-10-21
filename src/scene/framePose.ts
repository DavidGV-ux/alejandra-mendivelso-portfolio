import { Vector3, type PerspectiveCamera } from 'three';
import {
  framePositionCorridor,
  isClosingFrame,
  type CorridorLayout,
} from '@/scene/corridorLayout';
import { sceneConfig } from '@/config/scene.config';

export interface FrameTransform {
  /** Position of the frame wrapper in world space (before rotation). */
  position: Vector3;
  /** Y-axis rotation (radians) of the frame wrapper. */
  rotationY: number;
  /** World-space normal of the visible face (+Z of PlaneGeometry). */
  normal: Vector3;
}

/**
 * Wrapper transform for a frame.
 *
 * PlaneGeometry faces +Z. After `rotation.y`:
 *   local +Z → (sin(rY), 0, cos(rY)).
 *
 * Side frames face the aisle (inward). Closing frames face the incoming viewer (−Z).
 */
export function frameTransform(
  index: number,
  total: number,
  layout: CorridorLayout,
  out: Vector3 = new Vector3(),
): FrameTransform {
  const isClosing = isClosingFrame(index, total);
  framePositionCorridor(index, total, layout, out);

  // Closing frames face the incoming viewer (−Z); side frames face the aisle.
  const rotationY = isClosing ? Math.PI : out.x < 0 ? Math.PI / 2 : -Math.PI / 2;

  return {
    position: out.clone(),
    rotationY,
    normal: frameNormal(rotationY),
  };
}

/** World-space visible-face normal from a wrapper's Y-rotation. */
export function frameNormal(rotationY: number): Vector3 {
  return new Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
}

export interface FrontalPose {
  /** Camera world position. */
  position: Vector3;
  /** Camera look-at target in world space. */
  target: Vector3;
  /**
   * Yaw for the free-look rig: `lookDir = (sin(yaw), 0, cos(yaw))`.
   * Frontal view looks along −normal, so `yaw = atan2(−n.x, −n.z)`.
   */
  yaw: number;
  /** Pitch (always 0 for frontal view). */
  pitch: number;
  /** Focus FOV. */
  fov: number;
}

/**
 * Camera on the visible side of the frame, looking straight at its centre.
 *
 *   position = center + normal * distance + (0, verticalShift, 0)
 *   target   = center + (0, verticalShift, 0)
 *
 * Then `getWorldDirection()` ≈ −normal and `(P − C) · n > 0`.
 */
export function computeFrontalPose(opts: {
  center: Vector3;
  normal: Vector3;
  distance: number;
  verticalShift?: number;
  fov?: number;
}): FrontalPose {
  const verticalShift = opts.verticalShift ?? 0;
  const n = opts.normal;
  const fov = opts.fov ?? sceneConfig.focus.fov;

  const position = new Vector3(
    opts.center.x + n.x * opts.distance,
    opts.center.y + verticalShift,
    opts.center.z + n.z * opts.distance,
  );

  const target = new Vector3(
    opts.center.x,
    opts.center.y + verticalShift,
    opts.center.z,
  );

  const yaw = Math.atan2(-n.x, -n.z);
  const pitch = 0;

  return { position, target, yaw, pitch, fov };
}

/** Distance so the frame fills ~68% of the unused vertical FOV, clamped to the aisle. */
export function computeFocusDistance(camera: PerspectiveCamera, layout: CorridorLayout): number {
  const scale = layout.compact ? 0.82 : 1;
  const H = sceneConfig.frame.height * scale;
  const W = sceneConfig.frame.width * scale;
  const verticalFov =
    ((layout.compact ? sceneConfig.focus.fovCompact : sceneConfig.focus.fov) * Math.PI) / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const dVertical = H / (2 * Math.tan(verticalFov / 2) * sceneConfig.focus.fillV);
  const dHorizontal = W / (2 * Math.tan(horizontalFov / 2) * sceneConfig.focus.fillH);
  const d = Math.max(dVertical, dHorizontal);
  const maxD = Math.max(1.2 * H, layout.wallOffset * 2 - sceneConfig.focus.margin);
  return Math.min(maxD, Math.max(1.2 * H, d));
}
