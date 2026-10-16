import {
  CanvasTexture,
  Color,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type PerspectiveCamera,
  type Scene,
} from 'three';
import type { ThemeMode } from '@/types/theme';

export interface CloudsHandle {
  setMode: (mode: Exclude<ThemeMode, 'auto'>) => void;
  /** Amplifica el parallax según la orientación de la cámara (solo al renderizar). */
  update: (camera: PerspectiveCamera) => void;
  dispose: () => void;
}

interface CloudSpec {
  mesh: Mesh;
  baseOpacity: number;
}

/**
 * Nubes de fondo: planos suaves generados en canvas, repartidos en un anillo
 * lejano. El movimiento sale del parallax real de la cámara (y un pequeño
 * refuerzo por orientación), así que en reposo no cuestan nada: el loop de
 * render bajo demanda no se despierta.
 */
export function createClouds(
  scene: Scene,
  mode: Exclude<ThemeMode, 'auto'>,
  count: number,
): CloudsHandle {
  const group = new Group();
  group.renderOrder = -1;

  const geometry = new PlaneGeometry(1, 1);
  const textures = [makeCloudTexture(7), makeCloudTexture(13), makeCloudTexture(29)];
  const material = new MeshBasicMaterial({
    map: textures[0],
    transparent: true,
    depthWrite: false,
    fog: true,
    toneMapped: false,
  });

  const color = new Color();
  const clouds: CloudSpec[] = [];

  for (let i = 0; i < count; i++) {
    const mat = i === 0 ? material : material.clone();
    mat.map = textures[i % textures.length]!;
    const mesh = new Mesh(geometry, mat);

    const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.35;
    const radius = 40 + (i % 3) * 10;
    const height = 6 + (i % 4) * 4.5;
    mesh.position.set(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius,
    );
    mesh.lookAt(0, height, 0);

    const width = 36 + (i % 3) * 10;
    mesh.scale.set(width, width * 0.42, 1);
    mesh.rotation.z = ((i % 5) - 2) * 0.045;

    clouds.push({ mesh, baseOpacity: 0.5 + (i % 3) * 0.12 });
    group.add(mesh);
  }

  scene.add(group);

  function setMode(next: Exclude<ThemeMode, 'auto'>): void {
    // De día no hay nubes: el fondo queda blanco puro y limpio.
    group.visible = next === 'dark';
    color.set(next === 'dark' ? '#4a4a5c' : '#ffffff');
    clouds.forEach(({ mesh, baseOpacity }) => {
      const mat = mesh.material as MeshBasicMaterial;
      mat.color.copy(color);
      mat.opacity = next === 'dark' ? baseOpacity * 0.9 : baseOpacity;
      mat.needsUpdate = true;
    });
  }
  setMode(mode);

  return {
    setMode,
    update(camera: PerspectiveCamera): void {
      group.rotation.y = -camera.rotation.y * 0.06;
      group.position.y = camera.position.y * 0.08;
    },
    dispose(): void {
      scene.remove(group);
      clouds.forEach(({ mesh }) => (mesh.material as MeshBasicMaterial).dispose());
      material.dispose();
      textures.forEach((t) => t.dispose());
      geometry.dispose();
      group.clear();
    },
  };
}

/** Textura suave de nube: racimos de degradados radiales sobre canvas. */
function makeCloudTexture(seed: number): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  let state = seed;
  const rand = (): number => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  const blobs = 32;
  for (let i = 0; i < blobs; i++) {
    const cx = size * (0.16 + rand() * 0.68);
    const cy = size * (0.4 + rand() * 0.28);
    const r = size * (0.09 + rand() * 0.17);
    const alpha = 0.07 + rand() * 0.09;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    gradient.addColorStop(0.55, `rgba(255, 255, 255, ${alpha * 0.6})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
