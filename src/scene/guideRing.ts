import { BufferGeometry, Group, Line, LineBasicMaterial, Vector3 } from 'three';
import { theme } from '@/config/theme';
import type { ThemeMode } from '@/types/theme';
import type { CorridorLayout } from './corridor';

export interface GuideHandle {
  line: Group;
  setMode: (mode: Exclude<ThemeMode, 'auto'>) => void;
}

/**
 * Dibuja los rieles del suelo y techo del pasillo para reforzar la perspectiva.
 */
export function createGuideLine(
  total: number,
  layout: CorridorLayout,
  mode: Exclude<ThemeMode, 'auto'> = 'light',
): GuideHandle {
  const spacing = layout.spacing;
  const pairCount = Math.ceil(total / 2);
  const center = ((pairCount - 1) / 2) * spacing;
  // El pasillo termina justo después del último par de marcos para evitar vacío.
  const startZ = -center - spacing;
  const endZ = (pairCount - 1) * spacing - center + spacing * 0.5;
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

for (let p = 0; p < pairCount; p++) {
    const z = p * spacing - center;
    const geom = new BufferGeometry().setFromPoints([
      new Vector3(-halfW, -halfH, z),
      new Vector3(halfW, -halfH, z),
    ]);
    group.add(new Line(geom, matSoft));
  }

  function setMode(mode: Exclude<ThemeMode, 'auto'>): void {
    // De día los rieles desaparecen: entorno blanco puro sin líneas.
    group.visible = mode === 'dark';
  }
  setMode('light');

  setMode(mode);

  return { line: group, setMode };
}
