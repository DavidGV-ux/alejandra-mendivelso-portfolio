import { Vector3 } from 'three';
import { theme } from '@/config/theme';
import { sceneConfig } from '@/config/scene.config';
import type { Capabilities } from '@/types/theme';

export interface LayoutConfig {
  radius: number;
  spacing: number;
  turns: number;
  orbitRadius: number;
  heightOffset: number;
  compact: boolean;
}

export function buildLayoutConfig(caps: Capabilities): LayoutConfig {
  const compact = Math.min(window.innerWidth, window.innerHeight) < 560 || caps.tier === 'low';
  const scale = compact ? 0.72 : 1;
  return {
    radius: theme.spiralRadius * scale,
    spacing: theme.frameSpacing * (compact ? 0.82 : 1),
    turns: theme.spiralTurns,
    orbitRadius: sceneConfig.camera.orbitRadius * (compact ? 0.8 : 1),
    heightOffset: sceneConfig.camera.heightOffset,
    compact,
  };
}

export function angleStep(config: LayoutConfig, total: number): number {
  if (total <= 1) return 0;
  return (config.turns * Math.PI * 2) / total;
}

export function angleFor(index: number, config: LayoutConfig, total: number): number {
  return index * angleStep(config, total);
}

/** Altura centrada en 0 para que el conjunto quede equilibrado verticalmente. */
export function heightFor(index: number, config: LayoutConfig, total: number): number {
  const center = ((total - 1) / 2) * config.spacing;
  return index * config.spacing - center;
}

export function framePosition(
  index: number,
  total: number,
  config: LayoutConfig,
  out: Vector3 = new Vector3(),
): Vector3 {
  const angle = angleFor(index, config, total);
  const y = heightFor(index, config, total);
  return out.set(Math.sin(angle) * config.radius, y, Math.cos(angle) * config.radius);
}

export interface CameraPose {
  position: Vector3;
  target: Vector3;
}

export function cameraPose(
  index: number,
  total: number,
  config: LayoutConfig,
  out: CameraPose = { position: new Vector3(), target: new Vector3() },
): CameraPose {
  const angle = angleFor(index, config, total);
  const y = heightFor(index, config, total);
  out.position.set(
    Math.sin(angle) * config.orbitRadius,
    y + config.heightOffset,
    Math.cos(angle) * config.orbitRadius,
  );
  framePosition(index, total, config, out.target);
  return out;
}
