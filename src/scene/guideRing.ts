import { BufferGeometry, Group, Line, LineBasicMaterial, Vector3 } from 'three';
import { theme } from '@/config/theme';
import type { CorridorLayout } from './corridor';

export interface GuideHandle {
  line: Group;
}

/**
 * Dibuja los rieles del suelo y techo del pasillo para reforzar la perspectiva.
 */
export function createGuideLine(total: number, layout: CorridorLayout): GuideHandle {
  const spacing = layout.spacing;
  const center = ((total - 1) / 2) * spacing;
  const startZ = -center - spacing;
  const endZ = center + spacing;
  const halfW = layout.wallOffset;
  const halfH = 2.2;

  const mat = new LineBasicMaterial({
    color: theme.colors.borderStrong,
    transparent: true,
    opacity: 0.22,
  });
  const matSoft = new LineBasicMaterial({
    color: theme.colors.borderStrong,
    transparent: true,
    opacity: 0.1,
  });

  const group = new Group();

  const rail = (x: number, y: number, material: LineBasicMaterial): void => {
    const geom = new BufferGeometry().setFromPoints([
      new Vector3(x, y, startZ),
      new Vector3(x, y, endZ),
    ]);
    group.add(new Line(geom, material));
  };

  rail(-halfW, -halfH, mat);
  rail(halfW, -halfH, mat);
  rail(-halfW, halfH, matSoft);
  rail(halfW, halfH, matSoft);

  for (let i = 0; i < total; i++) {
    const z = i * spacing - center;
    const geom = new BufferGeometry().setFromPoints([
      new Vector3(-halfW, -halfH, z),
      new Vector3(halfW, -halfH, z),
    ]);
    group.add(new Line(geom, matSoft));
  }

  return { line: group };
}
