import { Vector3 } from 'three';
import { sceneConfig } from '@/config/scene.config';
import type { Capabilities } from '@/types/theme';

export interface CorridorLayout {
  spacing: number;
  width: number;
  height: number;
  depth: number;
  wallOffset: number;
  compact: boolean;
}

export function buildCorridorLayout(caps: Capabilities): CorridorLayout {
  const compact = Math.min(window.innerWidth, window.innerHeight) < 560 || caps.tier === 'low';
  const scale = compact ? 0.82 : 1;
  return {
    spacing: 4.0 * scale,
    width: 24 * scale,
    height: 4.5 * scale,
    depth: 60 * scale,
    wallOffset: 4.8 * scale,
    compact,
  };
}

/** Profundidad de la pantalla que cierra el pasillo, más allá del último marco. */
export function endScreenZ(total: number, layout: CorridorLayout): number {
  const pairCount = Math.ceil(total / 2);
  const center = ((pairCount - 1) / 2) * layout.spacing;
  return Math.floor((total - 1) / 2) * layout.spacing - center + layout.spacing * 2.2;
}

/** Profundidad para el proyecto centrado al fondo del pasillo. */
export function endBackdropZ(layout: CorridorLayout): number {
  return layout.spacing * 2;
}

/**
 * Cantidad de marcos que cierran el pasillo de frente al visitante.
 * Con un total impar se usan tres para que no quede un marco suelto en un
 * lateral; con un total par se mantienen los dos históricos.
 */
export function closingFrameCount(total: number): number {
  if (total <= 0) return 0;
  if (total <= 2) return total;
  return total % 2 === 0 ? 2 : 3;
}

export function isClosingFrame(index: number, total: number): boolean {
  return index >= total - closingFrameCount(total);
}

/** Separación horizontal del trío trasero (siempre mayor que el ancho del marco). */
function closingStep(layout: CorridorLayout): number {
  return Math.max(layout.wallOffset * 0.95, sceneConfig.frame.width * 1.07);
}

/**
 * Posición del marco en el pasillo. La fila trasera comparte profundidad y
 * mira hacia la cámara; los laterales se emparejan a izquierda y derecha.
 */
export function framePositionCorridor(
  index: number,
  total: number,
  config: CorridorLayout,
  out: Vector3 = new Vector3(),
): Vector3 {
  const pairCount = Math.ceil(total / 2);
  const center = ((pairCount - 1) / 2) * config.spacing;
  const closing = closingFrameCount(total);

  if (index >= total - closing) {
    const slot = index - (total - closing);
    let x = 0;
    if (closing === 2) {
      x = (slot === 0 ? -1 : 1) * config.wallOffset * 0.55;
    } else if (closing >= 3) {
      x = (slot - (closing - 1) / 2) * closingStep(config);
    }
    const z = (pairCount - 1) * config.spacing - center + config.spacing * 1.05;
    return out.set(x, 0, z);
  }

  const x = (index % 2 === 0 ? -config.wallOffset : config.wallOffset) * (config.compact ? 0.85 : 1);
  const y = 0;
  const z = Math.floor(index / 2) * config.spacing - center;
  return out.set(x, y, z);
}
