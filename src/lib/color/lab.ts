import type { Rgb } from "../blocks/types";

export interface Lab {
  l: number;
  a: number;
  b: number;
}

/** sRGB channel (0-255) → linear-light (0-1). */
export function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** sRGB (0-255) → CIE XYZ (D65). */
export function srgbToXyz([r, g, b]: Rgb): [number, number, number] {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  return [
    rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375,
    rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175,
    rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041,
  ];
}

const D65 = [0.95047, 1.0, 1.08883] as const;

function f(t: number): number {
  const e = 216 / 24389;
  const k = 24389 / 27;
  return t > e ? Math.cbrt(t) : (k * t + 16) / 116;
}

/** sRGB (0-255) → CIE L*a*b* (D65). */
export function srgbToLab(rgb: Rgb): Lab {
  const [x, y, z] = srgbToXyz(rgb);
  const fx = f(x / D65[0]);
  const fy = f(y / D65[1]);
  const fz = f(z / D65[2]);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** CIE76 colour difference — Euclidean distance in L*a*b*. */
export function deltaE(a: Lab, b: Lab): number {
  const dl = a.l - b.l;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}
