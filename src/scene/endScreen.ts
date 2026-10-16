import {
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Texture,
} from 'three';
import { theme } from '@/config/theme';

export interface EndScreenHandle {
  group: Group;
  setImage: (texture: Texture) => void;
  dispose: () => void;
}

const W = 6;
const H = 3.2;
const MAT = 0.2;
const BORDER = 0.04;

/**
 * Pantalla que cierra el pasillo: muestra un proyecto real y marca el
 * límite visual del espacio. Es decorativa (no intercepta el puntero).
 */
export function createEndScreen(): EndScreenHandle {
  const group = new Group();
  group.rotation.y = Math.PI;

  const borderMat = new MeshStandardMaterial({
    color: theme.colors.frameBorder,
    roughness: 0.9,
    metalness: 0,
  });
  const matMat = new MeshStandardMaterial({
    color: theme.colors.frame,
    roughness: 0.95,
    metalness: 0,
  });
  const imageMat = new MeshBasicMaterial({
    color: theme.colors.textFaint,
    toneMapped: true,
  });

  const border = new Mesh(
    new PlaneGeometry(W + 2 * MAT + 2 * BORDER, H + 2 * MAT + 2 * BORDER),
    borderMat,
  );
  const mat = new Mesh(new PlaneGeometry(W + 2 * MAT, H + 2 * MAT), matMat);
  mat.position.z = 0.012;
  const image = new Mesh(new PlaneGeometry(W, H), imageMat);
  image.position.z = 0.024;

  group.add(border, mat, image);

  return {
    group,
    setImage(texture: Texture): void {
      const source = texture.image as
        | HTMLVideoElement
        | HTMLImageElement
        | ImageBitmap
        | undefined;
      let w: number | undefined;
      let h: number | undefined;
      if (source instanceof HTMLVideoElement) {
        w = source.videoWidth;
        h = source.videoHeight;
      } else if (source) {
        w = source.width;
        h = source.height;
      }
      if (w && h) {
        const aspect = w / h;
        const frameAspect = W / H;
        if (aspect > frameAspect) {
          image.scale.set(1, frameAspect / aspect, 1);
        } else {
          image.scale.set(aspect / frameAspect, 1, 1);
        }
      }
      imageMat.map = texture;
      imageMat.color.setRGB(1, 1, 1);
      imageMat.needsUpdate = true;
    },
    dispose(): void {
      border.geometry.dispose();
      mat.geometry.dispose();
      image.geometry.dispose();
      borderMat.dispose();
      matMat.dispose();
      imageMat.dispose();
      group.clear();
    },
  };
}
