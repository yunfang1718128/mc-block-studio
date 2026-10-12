/** A scale factor expressed as an exact rational, e.g. `{num: 1, den: 4}` = 1/4×. */
export interface ScaleStep {
  readonly num: number;
  readonly den: number;
}

const step = (num: number, den: number): ScaleStep => ({ num, den });

/**
 * The slider ladder, from 1/4× down-scaling up to 12× up-scaling. Index 3 is 1×
 * (native resolution); anything below shrinks, anything above expands. Sliders
 * store this integer index so fractional steps stay exact (1/3 is not a float).
 */
export const SCALE_LADDER: readonly ScaleStep[] = [
  step(1, 4),
  step(1, 3),
  step(1, 2),
  step(1, 1),
  step(2, 1),
  step(3, 1),
  step(4, 1),
  step(5, 1),
  step(6, 1),
  step(7, 1),
  step(8, 1),
  step(9, 1),
  step(10, 1),
  step(11, 1),
  step(12, 1),
];

export const SCALE_MIN_INDEX = 0;
export const SCALE_MAX_INDEX = SCALE_LADDER.length - 1;

/** The ladder step for a slider index, clamped into range. */
export function scaleStepFor(index: number): ScaleStep {
  const i = Math.min(SCALE_MAX_INDEX, Math.max(SCALE_MIN_INDEX, Math.round(index)));
  return SCALE_LADDER[i];
}

/** Display label for a step, e.g. `1/4×`, `1×`, `12×`. */
export function scaleLabel(scale: ScaleStep): string {
  return scale.den === 1 ? `${scale.num}×` : `${scale.num}/${scale.den}×`;
}

/** True when the step shrinks the model below native resolution. */
export function isShrink(scale: ScaleStep): boolean {
  return scale.num < scale.den;
}

/**
 * Split `total` pixels into `parts` cells with mirror-symmetric widths.
 *
 * Naive `ceil`/fixed-stride splits dump every leftover pixel on the last cell,
 * which breaks left-right symmetry for sizes not divisible by the factor. The
 * first half of the boundaries is placed proportionally (`round(i·total/parts)`)
 * and the second half mirrored, so cell widths read the same from either end.
 * Returns `parts + 1` boundaries, cell `i` covering `[b[i], b[i+1])`.
 */
export function symmetricPartition(total: number, parts: number): number[] {
  const b: number[] = new Array(parts + 1);
  b[0] = 0;
  b[parts] = total;
  for (let i = 1; i < parts; i++) {
    b[i] = i <= parts - i ? Math.round((i * total) / parts) : total - b[parts - i];
  }
  return b;
}
