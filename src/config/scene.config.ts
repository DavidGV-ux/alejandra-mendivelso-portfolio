import { theme } from './theme';

/**
 * Parámetros estructurales de la escena y los controles (no visuales).
 * Los tokens visuales viven en theme.ts.
 */
export const sceneConfig = {
  camera: {
    fov: 90,
    near: 0.1,
    far: 200,
    /** Radio de la cámara respecto al eje de la hélice */
    orbitRadius: 3.4,
    /** Altura de la cámara respecto al marco activo */
    heightOffset: 0.15,
    /** Desplazamiento lateral hacia el marco al enfocar */
    focusPush: 1.6,
  },
  frame: {
    width: 4,
    height: 2.75,
    depth: 0.16,
    /** Escala del marco activo */
    activeScale: 1.06,
    /** Escala al pasar el cursor */
    hoverScale: 1.03,
    /** Desplazamiento vertical al pasar el cursor */
    hoverLift: 0.18,
    /** Opacidad de marcos no activos */
    inactiveOpacity: 1,
  },
  controls: {
    /** Factor de amortiguación de inercia por frame (0–1) */
    damping: 0.085,
    /** Duración mínima (ms) entre cambios de índice por rueda */
    wheelCooldown: 420,
    /** Umbral de arrastre (px) para distinguir un tap de un gesto de cámara */
    dragThreshold: 8,
    /** Sensibilidad del drag/scroll */
    sensitivity: 1,
  },
  fog: {
    near: 6,
    far: 46,
  },
  /** Distancia máxima de la cámara al eje (límite de seguridad) */
  cameraLimits: {
    minY: -2,
    maxYOffset: theme.frameSpacing * 20,
  },
  intro: {
    /** Duración total (s) de la animación de ensamblaje */
    duration: 2,
  },
  focus: {
    fillV: 0.68,
    fillH: 0.80,
    fov: 62,
    fovCompact: 70,
    safeTop: 120,
    safeBottom: 140,
    margin: 0.6,
  },
  video: {
    /** Videos activos por tier */
    maxActive: { high: 4, medium: 3, low: 1 } as Record<'high'|'medium'|'low', number>,
    /** Distancia máxima de la cámara al marco para activar video */
    maxDistance: 26,
    /** Ancho máximo del canvas de preview (la altura sigue el aspecto nativo). */
    previewMaxWidth: { high: 1024, medium: 768, low: 512 } as Record<'high'|'medium'|'low', number>,
    /** Tope de subidas a GPU por segundo; no se decodifica más de esto. */
    previewFps: { high: 24, medium: 18, low: 10 } as Record<'high'|'medium'|'low', number>,
  },
  lights: {
    ambient: 0.85,
    key: 1.1,
    rim: 0.5,
  },
} as const;

export type SceneConfig = typeof sceneConfig;
