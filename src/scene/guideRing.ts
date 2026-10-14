import {
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Vector3,
} from 'three';
import { theme } from '@/config/theme';
import { framePosition, type LayoutConfig } from './layout';

/** Línea tenue que dibuja la trayectoria de la hélice: firma visual de la galería. */
export function createGuideLine(
  total: number,
  layout: LayoutConfig,
): { line: Line; dispose: () => void } {
  const samples = total * 16 + 1;
  const points: number[] = [];
  const v = new Vector3();

  for (let i = 0; i < samples; i++) {
    const t = (i / (samples - 1)) * (total - 1);
    const lower = Math.floor(t);
    const upper = Math.min(total - 1, Math.ceil(t));
    const frac = t - lower;
    const a = framePosition(lower, total, layout, new Vector3());
    const b = framePosition(upper, total, layout, new Vector3());
    v.copy(a).lerp(b, frac);
    v.y += 0.9; // la guía va por encima de los marcos
    points.push(v.x, v.y, v.z);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  const material = new LineBasicMaterial({
    color: theme.colors.accent,
    transparent: true,
    opacity: 0.22,
    fog: true,
  });
  const line = new Line(geometry, material);

  return {
    line,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
