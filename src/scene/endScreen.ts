import {
  CanvasTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { getPalette, theme } from '@/config/theme';

export interface EndScreenHandle {
  group: Group;
  /** Hitbox invisible: al pulsarla se abre la sección Acerca de mí. */
  hitMesh: Mesh;
  /** Dibuja la tarjeta de cierre (foto + texto) y la muestra en el plano. */
  renderCard: (
    photo: HTMLImageElement | null,
    title: string,
    subtitle: string,
    mode: 'light' | 'dark',
  ) => void;
  /** Paralaje del contenido según el puntero (`nx`, `ny` en [-1, 1]). */
  setHover: (nx: number, ny: number, active: boolean) => void;
  /** Avanza la animación; devuelve true mientras haya que repintar. */
  update: (dt: number) => boolean;
  /** Indica si la animación ha terminado. */
  isSettled: () => boolean;
  dispose: () => void;
}

const W = 6;
const H = 3.2;
const MAT = 0.2;
const BORDER = 0.04;

const CW = 1280;
const CH = 682; // aspecto 6 : 3.2

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

  // Lienzo persistente: se repinta en cada cambio (tema, carga o parallax).
  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d')!;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  imageMat.map = texture;
  imageMat.needsUpdate = true;

  let photo: HTMLImageElement | null = null;
  let title = '';
  let subtitle = '';
  let mode: 'light' | 'dark' = 'dark';
  let hasCard = false;

  // Parallax: valores actuales y objetivo (se interpola en `update`).
  let curX = 0;
  let curY = 0;
  let curI = 0;
  let targetX = 0;
  let targetY = 0;
  let targetI = 0;

  function paint(): void {
    if (!hasCard) return;

    const pal = getPalette(mode);
    const bg = mode === 'light' ? '#ffffff' : pal.bg;
    const fg = pal.text;
    const muted = pal.textMuted;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CW, CH);

    const i = curI;
    const nx = curX;
    const ny = curY;

    // Foto con parallax suave y ligero zoom.
    const photoSize = CH * 0.74;
    const photoX = CW * 0.075;
    const photoY = (CH - photoSize) / 2;
    const radius = 34;
    const scale = 1 + 0.03 * i;
    const ps = photoSize * scale;
    const px = photoX - (ps - photoSize) / 2 - nx * 14;
    const py = photoY - (ps - photoSize) / 2 - ny * 12;

    ctx.save();
    roundRect(ctx, photoX, photoY, photoSize, photoSize, radius);
    ctx.clip();
    if (photo) {
      const sAspect = photo.width / photo.height;
      let dw = ps;
      let dh = ps;
      let dx = px;
      let dy = py;
      if (sAspect > 1) {
        dw = ps * sAspect;
        dx = px - (dw - ps) / 2;
      } else {
        dh = ps / sAspect;
        dy = py - (dh - ps) / 2;
      }
      ctx.drawImage(photo, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = mode === 'light' ? '#f0f0f0' : pal.surface2;
      ctx.fillRect(photoX, photoY, photoSize, photoSize);
    }
    ctx.restore();

    // Marco fino alrededor de la foto.
    ctx.save();
    roundRect(ctx, photoX, photoY, photoSize, photoSize, radius);
    ctx.strokeStyle = mode === 'light' ? 'rgba(17,17,17,0.12)' : 'rgba(248,246,242,0.14)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    const textX = photoX + photoSize + CW * 0.055;
    const maxTextW = CW - textX - CW * 0.055;
    const chars = Array.from(title);
    const trackingFor = (size: number): number => -size * 0.022;

    // Ajuste automático del título para que nunca se corte.
    const titleWidth = (size: number): number => {
      ctx.font = `700 ${size}px ${theme.fonts.display}`;
      let w = 0;
      for (const c of chars) w += ctx.measureText(c).width;
      return w + trackingFor(size) * Math.max(0, chars.length - 1);
    };

    let titleSize = 150;
    while (titleSize > 56 && titleWidth(titleSize) > maxTextW) titleSize -= 2;

    const titleY = CH * 0.42;
    ctx.fillStyle = fg;
    ctx.textBaseline = 'alphabetic';

    // Letras con onda suave que viaja con el puntero.
    ctx.font = `700 ${titleSize}px ${theme.fonts.display}`;
    const track = trackingFor(titleSize);
    const amp = 10 * i;
    const phase = nx * Math.PI * 1.2;
    let cx = textX + nx * 6;
    for (const [k, c] of chars.entries()) {
      const dy = Math.sin(k * 0.6 + phase) * amp - ny * 8 * i;
      ctx.fillText(c, cx, titleY + dy);
      cx += ctx.measureText(c).width + track;
    }

    // Subtítulo, también ajustado al ancho disponible.
    let subSize = 58;
    ctx.font = `500 ${subSize}px ${theme.fonts.display}`;
    while (subSize > 26 && ctx.measureText(subtitle).width > maxTextW) {
      subSize -= 2;
      ctx.font = `500 ${subSize}px ${theme.fonts.display}`;
    }
    const subY = titleY + titleSize * 0.72 + subSize * 0.9;
    ctx.fillStyle = muted;
    ctx.fillText(subtitle, textX + nx * 4, subY);

    // Acento bajo el título (crece al acercar el ratón).
    ctx.fillStyle = pal.accent;
    ctx.fillRect(textX, subY + 42, 150 + 40 * i, 8);

    // Píldora de acción.
    const hint =
      mode === 'light' ? 'Haz clic para conocer más sobre mí' : 'Click to learn more about me';
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

    texture.needsUpdate = true;
  }

  return {
    group,
    hitMesh,
    renderCard: (p, t, s, m) => {
      photo = p;
      title = t ?? '';
      subtitle = s ?? '';
      mode = m;
      hasCard = true;
      paint();
    },
    setHover: (nx, ny, active) => {
      targetX = Math.max(-1, Math.min(1, nx));
      targetY = Math.max(-1, Math.min(1, ny));
      targetI = active ? 1 : 0;
    },
    update: (dt) => {
      if (!hasCard) return false;
      const k = 1 - Math.exp(-10 * Math.max(dt, 0));
      let changed = false;
      const dx = targetX - curX;
      const dy = targetY - curY;
      const di = targetI - curI;
      if (Math.abs(dx) > 0.0006) {
        curX += dx * k;
        changed = true;
      } else curX = targetX;
      if (Math.abs(dy) > 0.0006) {
        curY += dy * k;
        changed = true;
      } else curY = targetY;
      if (Math.abs(di) > 0.0006) {
        curI += di * k;
        changed = true;
      } else curI = targetI;
      if (!changed) return false;
      paint();
      return true;
    },
    isSettled: () =>
      !hasCard ||
      (Math.abs(targetX - curX) < 0.001 &&
        Math.abs(targetY - curY) < 0.001 &&
        Math.abs(targetI - curI) < 0.001),
    dispose: () => {
      border.geometry.dispose();
      mat.geometry.dispose();
      image.geometry.dispose();
      hitMesh.geometry.dispose();
      borderMat.dispose();
      matMat.dispose();
      hitMat.dispose();
      texture.dispose();
      imageMat.dispose();
      group.clear();
    },
  };
}
