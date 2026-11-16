export const TAU = Math.PI * 2;

export function wrapPi(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

/** Rotate `from` toward `to` along the shortest arc by at most `maxStep` radians. */
export function turnToward(from: number, to: number, maxStep: number): number {
  const d = wrapPi(to - from);
  return Math.abs(d) <= maxStep ? to : from + Math.sign(d) * maxStep;
}
