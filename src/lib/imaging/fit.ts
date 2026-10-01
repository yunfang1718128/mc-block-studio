/**
 * Display-only scale for a preview canvas.
 *
 * `fit` never magnifies (small art stays at 1:1) and shrinks just enough that
 * both dimensions fit the available box. Any non-positive input falls back to
 * 1 so the first paint before measurement is not degenerate.
 */
export function fitScale(availWidth: number, availHeight: number, width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  if (availWidth <= 0 || availHeight <= 0) return 1;
  return Math.min(1, availWidth / width, availHeight / height);
}
