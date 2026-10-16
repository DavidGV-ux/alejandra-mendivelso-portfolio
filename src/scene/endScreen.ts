import {
  CanvasTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
} from 'three';
import { getPalette } from '@/config/theme';
import { theme } from '@/config/theme';

export interface EndScreenHandle {
  group: Group;
  /** Hitbox invisible: al pulsarla se abre la sección Acerca de mí. */
  hitMesh: Mesh;
  /** Dibuja la tarjeta de cierre (foto + texto) y la muestra en el plano. */
  renderCard: (photo: Texture | null, title: string, subtitle: string, mode: 'light' | 'dark') => void;
  dispose: () => void;
}

const W = 6;
const H = 3.2;
const MAT = 0.2;
const BORDER = 0.04;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Pantalla que cierra el pasillo: tarjeta con la foto y la presentación,
 * al estilo de «Sobre mí». Al pulsarla se navega a Acerca de mí.
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
  const imageMat = new MeshBasicMaterial({ toneMapped: true });

  const border = new Mesh(
    new PlaneGeometry(W + 2 * MAT + 2 * BORDER, H + 2 * MAT + 2 * BORDER),
    borderMat,
  );
  const mat = new Mesh(new PlaneGeometry(W + 2 * MAT, H + 2 * MAT), matMat);
  mat.position.z = 0.012;
  const image = new Mesh(new PlaneGeometry(W, H), imageMat);
  image.position.z = 0.024;

  const hitMat = new MeshBasicMaterial({ visible: false });
  const hitMesh = new Mesh(new PlaneGeometry(W + 2 * MAT, H + 2 * MAT), hitMat);
  hitMesh.position.z = 0.05;

  group.add(border, mat, image, hitMesh);

  function drawCard(photo: Texture | null, title: string, subtitle: string, mode: 'light' | 'dark'): void {
    const CW = 1536;
    const CH = 819; // aspecto 6 : 3.2
    const canvas = document.createElement('canvas');
    canvas.width = CW;
    canvas.height = CH;
    const ctx = canvas.getContext('2d')!;

    const pal = getPalette(mode);
    const bg = mode === 'light' ? '#ffffff' : pal.bg;
    const fg = mode === 'light' ? pal.text : pal.text;
    const muted = pal.textMuted;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CW, CH);

    // Foto con esquinas redondeadas en el lado izquierdo.
    const photoSize = CH * 0.78;
    const photoX = CW * 0.075;
    const photoY = (CH - photoSize) / 2;
    const radius = 34;

    if (photo?.image) {
      const src = photo.image as HTMLImageElement | ImageBitmap;
      const sAspect = src.width / src.height;
      ctx.save();
      roundRect(ctx, photoX, photoY, photoSize, photoSize, radius);
      ctx.clip();
      let dw = photoSize;
      let dh = photoSize;
      let dx = photoX;
      let dy = photoY;
      if (sAspect > 1) {
        dw = photoSize * sAspect;
        dx = photoX - (dw - photoSize) / 2;
      } else {
        dh = photoSize / sAspect;
        dy = photoY - (dh - photoSize) / 2;
      }
      ctx.drawImage(src, dx, dy, dw, dh);
      ctx.restore();
    } else {
      ctx.save();
      roundRect(ctx, photoX, photoY, photoSize, photoSize, radius);
      ctx.fillStyle = mode === 'light' ? '#f0f0f0' : pal.surface2;
      ctx.fill();
      ctx.restore();
    }

    // Marco fino alrededor de la foto.
    ctx.save();
    roundRect(ctx, photoX, photoY, photoSize, photoSize, radius);
    ctx.strokeStyle = mode === 'light' ? 'rgba(17,17,17,0.12)' : 'rgba(248,246,242,0.14)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Texto a la derecha, en la misma familia tipográfica del panel.
    const textX = photoX + photoSize + CW * 0.06;
    const maxTextW = CW - textX - CW * 0.06;

    ctx.fillStyle = fg;
    ctx.textBaseline = 'alphabetic';

    const titleSize = 118;
    ctx.font = `600 ${titleSize}px ${theme.fonts.display}`;
    ctx.fillText(title, textX, CH * 0.47);

    const subSize = 62;
    ctx.font = `500 ${subSize}px ${theme.fonts.display}`;
    ctx.fillStyle = muted;
    ctx.fillText(subtitle, textX, CH * 0.47 + subSize * 1.35);

    // Acento bajo el título.
    ctx.fillStyle = mode === 'light' ? pal.accent : pal.accent;
    ctx.fillRect(textX, CH * 0.47 + subSize * 1.62, 150, 8);

    // Píldora de acción.
    const hint = mode === 'light' ? 'Haz clic para conocer más sobre mí' : 'Click to learn more about me';
    ctx.font = `500 30px ${theme.fonts.meta}`;
    const hintW = ctx.measureText(hint).width;
    const pillW = hintW + 64;
    const pillH = 58;
    const pillX = textX;
    const pillY = CH * 0.78;
    ctx.fillStyle = mode === 'light' ? 'rgba(17,17,17,0.06)' : 'rgba(248,246,242,0.08)';
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = muted;
    ctx.fillText(hint, pillX + 32, pillY + pillH / 2 + 11);

    void maxTextW;

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;

    imageMat.map = texture;
    imageMat.color.setRGB(1, 1, 1);
    imageMat.needsUpdate = true;
  }

  return {
    group,
    hitMesh,
    renderCard: (photo, title, subtitle, mode) => {
      drawCard(photo, title, subtitle, mode);
    },
    dispose: () => {
      border.geometry.dispose();
      mat.geometry.dispose();
      image.geometry.dispose();
      hitMesh.geometry.dispose();
      borderMat.dispose();
      matMat.dispose();
      hitMat.dispose();
      imageMat.map?.dispose();
      imageMat.dispose();
      group.clear();
    },
  };
}
