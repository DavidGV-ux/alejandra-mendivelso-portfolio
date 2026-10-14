import type { PerspectiveCamera, WebGLRenderer } from 'three';

export interface ResizeHandle {
  dispose: () => void;
}

export function bindResize(
  container: HTMLElement,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  onResize?: (width: number, height: number) => void,
): ResizeHandle {
  const apply = (): void => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    onResize?.(width, height);
  };

  const observer = new ResizeObserver(() => apply());
  observer.observe(container);
  window.addEventListener('orientationchange', apply);
  apply();

  return {
    dispose(): void {
      observer.disconnect();
      window.removeEventListener('orientationchange', apply);
    },
  };
}
