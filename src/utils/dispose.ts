import { Material, Texture, type Object3D } from 'three';

/** Libera geometrías, materiales y texturas de un árbol de objetos. */
export function disposeObject(root: Object3D): void {
  root.traverse((child) => {
    const mesh = child as unknown as {
      geometry?: { dispose?: () => void };
      material?: Material | Material[];
    };

    mesh.geometry?.dispose?.();

    const material = mesh.material;
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else if (material) disposeMaterial(material);
  });

  root.clear();
}

function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) value.dispose();
  }
  material.dispose();
}

/** Crea un temporizador rAF que se autolimpia. */
export function rafTimeout(callback: () => void, ms: number): () => void {
  let id = 0;
  let cancelled = false;
  const start = performance.now();

  const tick = (): void => {
    if (cancelled) return;
    if (performance.now() - start >= ms) {
      callback();
      return;
    }
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cancelAnimationFrame(id);
  };
}
