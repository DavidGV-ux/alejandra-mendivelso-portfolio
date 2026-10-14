import { CanvasTexture, LinearFilter, Sprite, SpriteMaterial } from 'three';

export interface LabelOptions {
  text: string;
  fontFamily: string;
  fontSize: number;
  weight?: string;
  color: string;
  accent?: string;
  /** Color de fondo del pin; si se define se dibuja una píldora redondeada. */
  background?: string;
  /** Alto en unidades de mundo del sprite resultante */
  worldHeight: number;
  letterSpacing?: number;
}

export interface LabelHandle {
  sprite: Sprite;
  setOpacity: (value: number) => void;
  dispose: () => void;
}

const PAD = 18;
const SCALE = 3; // supersampling para nitidez

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
): void {
  if (letterSpacing === 0) {
    ctx.fillText(text, x, y);
    return;
  }
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + letterSpacing;
  }
}

function measure(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number,
): number {
  let width = 0;
  for (const char of text) width += ctx.measureText(char).width + letterSpacing;
  return Math.max(0, width - letterSpacing);
}

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
  ctx.fill();
}

export function createLabel(options: LabelOptions): LabelHandle {
  const fontSize = options.fontSize * SCALE;
  const weight = options.weight ?? '500';
  const letterSpacing = (options.letterSpacing ?? 0) * SCALE;
  const pad = PAD * SCALE;

  const canvas = document.createElement('canvas');
  const measureCtx = canvas.getContext('2d')!;
  measureCtx.font = `${weight} ${fontSize}px ${options.fontFamily}`;
  const textWidth = measure(measureCtx, options.text, letterSpacing);

  const ascent = fontSize * 0.8;
  const descent = fontSize * 0.3;
  const accentBar = options.accent ? fontSize * 0.14 : 0;

  canvas.width = Math.ceil(textWidth + pad * 2);
  canvas.height = Math.ceil(ascent + descent + accentBar + pad * 2);

  const ctx = canvas.getContext('2d')!;
  ctx.font = `${weight} ${fontSize}px ${options.fontFamily}`;
  ctx.textBaseline = 'alphabetic';

  if (options.background) {
    ctx.fillStyle = options.background;
    roundRect(ctx, 0, 0, canvas.width, canvas.height, canvas.height / 2);
  }

  ctx.fillStyle = options.color;
  const baseY = pad + ascent;
  drawText(ctx, options.text, pad, baseY, letterSpacing);

  if (options.accent) {
    ctx.fillStyle = options.accent;
    ctx.fillRect(pad, baseY + descent * 0.5, textWidth, fontSize * 0.1);
  }

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });

  const sprite = new Sprite(material);
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(options.worldHeight * aspect, options.worldHeight, 1);
  sprite.userData.baseScale = { x: options.worldHeight * aspect, y: options.worldHeight };

  return {
    sprite,
    setOpacity: (value) => {
      material.opacity = value;
      sprite.visible = value > 0.01;
    },
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };
}
