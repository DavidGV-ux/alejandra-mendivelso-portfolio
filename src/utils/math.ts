export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Interpolación con amortiguación independiente del framerate. */
export const damp = (a: number, b: number, lambda: number, dt: number): number =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Envuelve un índice en el rango [0, length). */
export const wrap = (index: number, length: number): number =>
  ((index % length) + length) % length;

/** Diferencia angular más corta (para interpolar ángulos sin saltos). */
export const shortestAngle = (from: number, to: number): number => {
  const delta = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  return delta < -Math.PI ? delta + Math.PI * 2 : delta;
};

export const mapRange = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => {
  if (inMax === inMin) return outMin;
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + t * (outMax - outMin);
};
