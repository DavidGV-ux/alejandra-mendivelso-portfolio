import { Vector3 } from 'three';
import type { CorridorLayout } from '@/scene/corridor';
import { framePositionCorridor } from '@/scene/corridor';

export interface FrameTransform {
  /** Position of the frame wrapper in world space (before rotation). */
  position: Vector3;
  /** Y-axis rotation (radians) of the frame wrapper. */
  rotationY: number;
  /** World-space normal of the frame (derived from rotationY). */
  normal: Vector3;
}

/**
 * Compute the wrapper transform (position + y-rotation) for a frame.
 *
 * This is the single source of truth for frame placement. It mirrors the
 * logic that was previously inline in `createCorridor`:
 *  - The first `total-2` frames are placed along the corridor walls and
 *    "look at" the corridor centre-line (z-axis).
 *  - The last 2 frames close the corridor and face the camera (rotationY = π).
 *
 * Note: `framePositionCorridor` returns the wrapper position for the
 * non-closing frames. For the closing pair, the position is recomputed
 * here to match `createCorridor`'s inline logic (slightly different z).
 */
export function frameTransform(
  index: number,
  total: number,
  layout: CorridorLayout,
  out: Vector3 = new Vector3(),
): FrameTransform {
  const pairCount = Math.ceil(total / 2);
  const center = ((pairCount - 1) / 2) * layout.spacing;

  const isClosing = index >= total - 2;

  let pos: Vector3;
  let rotationY: number;

  if (isClosing) {
    // The last two frames close the corridor, together and facing forward.
    // Positioned at endBackdropZ distance, slightly inset on the wall.
    const x = (index % 2 === 0 ? -1 : 1) * layout.wallOffset * 0.55;
    const z = (pairCount - 1) * layout.spacing - center + layout.spacing * 1.05;
    pos = out.set(x, 0, z);
    rotationY = Math.PI;
  } else {
    // Place along walls, looking toward the corridor centre (z-axis).
    pos = framePositionCorridor(index, total, layout, out);
    // lookAt(0, y, z) → wrapper faces toward z-axis.
    // For left wall (x < 0): faces +x → rotationY = 0.
    // For right wall (x > 0): faces -x → rotationY = π.
    if (pos.x >= 0) {
      rotationY = Math.PI;
    } else {
      rotationY = 0;
    }
  }

  // Normal: (sin(rY), 0, cos(rY)) — Three.js plane at z=0 has normal +Z.
  const normal = new Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));

  return { position: pos, rotationY, normal };
}

/**
 * World-space normal from a wrapper's Y-rotation.
 */
export function frameNormal(rotationY: number): Vector3 {
  return new Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
}

export interface FrontalPose {
  /** Camera world position. */
  position: Vector3;
  /** Camera look-at target in world space. */
  target: Vector3;
  /** Internal yaw (radians) for the camera rig convention. */
  yaw: number;
  /** Pitch (always 0 for frontal view). */
  pitch: number;
}

/**
 * Compute a frontal camera pose that looks straight at a frame's centre
 * from along its world normal.
 *
 * Convention note:
 *   The camera rig in `cameraFreeLook` uses `lookDir = (sin(yaw), 0, cos(yaw))`,
 *   i.e. `yaw = atan2(lookDir.x, lookDir.z)`. For a frontal view we want the
 *   camera to look TOWARD the frame, i.e. `lookDir = normal`. Hence:
 *     yaw = atan2(normal.x, normal.z)
 *
 *   Three.js `camera.getWorldDirection()` returns the negated local -Z, which
 *   equals `lookDir` above. So `dot(getWorldDirection(), normal) = 1` (camera
 *   faces the frame), which means `dot(-normal, normal) = -1` → the camera
 *   backs away along `-normal` from the frame. That's correct: position is on
 *   the opposite side of the frame from its normal.
 */
export function computeFrontalPose(opts: {
  /** World-space centre of the frame image mesh. */
  center: Vector3;
  /** World-space normal of the frame (unit vector). */
  normal: Vector3;
  /** Distance to place the camera from the frame centre along its normal. */
  distance: number;
  /** Vertical offset applied to both position and target (to clear HUD/bar). */
  verticalShift?: number;
}): FrontalPose {
  const verticalShift = opts.verticalShift ?? 0;
  const n = opts.normal;

  // Camera backs away from the frame along its normal (toward viewer).
  const position = new Vector3(
    opts.center.x + n.x * opts.distance,
    opts.center.y + opts.distance * 0 + verticalShift,
    opts.center.z + n.z * opts.distance,
  );

  // Look target is the frame centre (plus vertical shift).
  const target = new Vector3(
    opts.center.x,
    opts.center.y + verticalShift,
    opts.center.z,
  );

  // yaw such that lookDir = normal.
  const yaw = Math.atan2(n.x, n.z);
  const pitch = 0;

  return { position, target, yaw, pitch };
}
