import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import type { CorridorLayout } from '@/scene/corridor';
import { framePositionCorridor } from '@/scene/corridor';
import { damp } from '@/utils/math';

export interface CameraFreeLook {
  /** Posición de viaje a lo largo del pasillo (eje Z). */
  setTravel: (z: number) => void;
  /** Aplica un giro absoluto (yaw/pitch) en radianes desde el inicio del gesto. */
  setLook: (yaw: number, pitch: number) => void;
  /** Giro actual, para continuar gestos de forma incremental. */
  getLook: () => { yaw: number; pitch: number };
  /** Ajusta el zoom (FOV) de forma relativa. */
  zoom: (delta: number) => void;
  /** Fija el FOV de forma absoluta. */
  setFov: (value: number) => void;
  getFov: () => number;
  /** Encuadra un marco concreto (modo detalle). */
  focusOn: (index: number, total: number, layout: CorridorLayout) => void;
  /** Vuelve a la vista de pasillo. */
  release: () => void;
  isFocused: () => boolean;
  update: (dt: number) => void;
  dispose: () => void;
}

const CAM_HEIGHT = 0.15;
const LOOK_AHEAD = 9;
export const YAW_SENSITIVITY = 0.0032;
export const PITCH_SENSITIVITY = 0.0026;
const MAX_PITCH = Math.PI / 5;
const MIN_FOV = 26;
const MAX_FOV = 62;

export function createCameraFreeLook(camera: PerspectiveCamera): CameraFreeLook {
  const baseFov = camera.fov;

  const position = new Vector3(0, CAM_HEIGHT, 0);
  const look = new Vector3(0, CAM_HEIGHT, LOOK_AHEAD);
  const desiredPos = position.clone();
  const desiredLook = look.clone();

  let travelZ = 0;
  let yaw = 0;
  let pitch = 0;
  let fov = baseFov;
  let desiredFov = baseFov;

  let focused = false;
  const focusPos = new Vector3();
  const focusLook = new Vector3();

  const dir = new Vector3();

  function computeDesired(): void {
    if (focused) {
      desiredPos.copy(focusPos);
      desiredLook.copy(focusLook);
      return;
    }
    desiredPos.set(0, CAM_HEIGHT, travelZ);
    const cosP = Math.cos(pitch);
    dir.set(Math.sin(yaw) * cosP, Math.sin(pitch), Math.cos(yaw) * cosP).multiplyScalar(LOOK_AHEAD);
    desiredLook.set(desiredPos.x + dir.x, desiredPos.y + dir.y, desiredPos.z + dir.z);
  }

  function apply(immediate: boolean, dt: number): void {
    computeDesired();
    if (immediate) {
      position.copy(desiredPos);
      look.copy(desiredLook);
      fov = desiredFov;
    } else {
      position.x = damp(position.x, desiredPos.x, 12, dt);
      position.y = damp(position.y, desiredPos.y, 12, dt);
      position.z = damp(position.z, desiredPos.z, 12, dt);
      look.x = damp(look.x, desiredLook.x, 12, dt);
      look.y = damp(look.y, desiredLook.y, 12, dt);
      look.z = damp(look.z, desiredLook.z, 12, dt);
      fov = damp(fov, desiredFov, 10, dt);
    }

    camera.position.copy(position);
    camera.lookAt(look);
    if (Math.abs(camera.fov - fov) > 0.001) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  apply(true, 0);

  return {
    setTravel: (z) => {
      travelZ = z;
    },
    setLook: (nextYaw, nextPitch) => {
      if (focused) return;
      yaw = nextYaw;
      pitch = MathUtils.clamp(nextPitch, -MAX_PITCH, MAX_PITCH);
    },
    getLook: () => ({ yaw, pitch }),
    zoom: (delta) => {
      desiredFov = MathUtils.clamp(desiredFov + delta, MIN_FOV, MAX_FOV);
    },
    setFov: (value) => {
      desiredFov = MathUtils.clamp(value, MIN_FOV, MAX_FOV);
    },
    getFov: () => desiredFov,
    focusOn: (index, total, layout) => {
      focused = true;
      const frame = framePositionCorridor(index, total, layout, new Vector3());
      const inward = frame.x >= 0 ? -1 : 1;
      focusPos.set(
        frame.x + inward * (layout.wallOffset * 0.7),
        CAM_HEIGHT,
        frame.z - layout.spacing * 0.15,
      );
      focusLook.copy(frame);
      desiredFov = 42;
    },
    release: () => {
      focused = false;
      desiredFov = baseFov;
    },
    isFocused: () => focused,
    update: (dt) => apply(false, dt),
    dispose: () => {},
  };
}
