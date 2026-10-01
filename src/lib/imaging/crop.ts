import type { ImageSource } from "./sample";

/** A rectangular region of a source image, in source pixels. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropBounds {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** A fixed `w:h` ratio, or `null` for an unconstrained (free) crop. */
export type CropRatio = { w: number; h: number } | null;

export interface CropAspect {
  id: string;
  label: string;
  ratio: CropRatio;
}

/** Ratio presets offered by the crop editor. */
export const CROP_ASPECTS: readonly CropAspect[] = [
  { id: "free", label: "自由", ratio: null },
  { id: "1:1", label: "1:1", ratio: { w: 1, h: 1 } },
  { id: "1:2", label: "1:2", ratio: { w: 1, h: 2 } },
  { id: "1:3", label: "1:3", ratio: { w: 1, h: 3 } },
  { id: "2:1", label: "2:1", ratio: { w: 2, h: 1 } },
  { id: "3:1", label: "3:1", ratio: { w: 3, h: 1 } },
];

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Round to integers and keep the rectangle inside `width × height`.
 *
 * The origin is clamped first, then the size shrinks to fit — so an
 * over-extending rectangle is pulled back from its top-left corner rather than
 * jumping to (0, 0).
 */
export function clampRect(rect: CropRect, width: number, height: number): CropRect {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const x = clampInt(rect.x, 0, w - 1);
  const y = clampInt(rect.y, 0, h - 1);
  const rw = clampInt(rect.width, 1, w - x);
  const rh = clampInt(rect.height, 1, h - y);
  return { x, y, width: rw, height: rh };
}

/** Copy the pixels of `rect` out of `src`, clamping the rectangle to the image. */
export function cropImageSource(src: ImageSource, rect: CropRect): ImageSource {
  const { x, y, width, height } = clampRect(rect, src.width, src.height);
  const out = new Uint8ClampedArray(width * height * 4);

  for (let row = 0; row < height; row++) {
    const start = ((y + row) * src.width + x) * 4;
    out.set(src.data.subarray(start, start + width * 4), row * width * 4);
  }

  return { data: out, width, height };
}

/** The largest centred rectangle of the given ratio that fits in the bounds. */
export function largestRectForRatio(bounds: CropBounds, ratio: { w: number; h: number }): CropRect {
  const { width, height } = bounds;
  const scale = Math.min(width / ratio.w, height / ratio.h);
  const w = Math.max(1, Math.floor(ratio.w * scale));
  const h = Math.max(1, Math.floor(ratio.h * scale));
  return clampRect({ x: (width - w) / 2, y: (height - h) / 2, width: w, height: h }, width, height);
}

/** True when `rect` covers the whole image. */
export function isFullCrop(rect: CropRect, bounds: CropBounds): boolean {
  return (
    rect.x === 0 &&
    rect.y === 0 &&
    rect.width === bounds.width &&
    rect.height === bounds.height
  );
}

/**
 * Compute a new rectangle while dragging a corner handle.
 *
 * `anchor` is the fixed opposite corner; `pointer` is the cursor in source
 * pixels. With a fixed `ratio` the result is the largest rectangle of that
 * ratio not exceeding the cursor, and it never leaves the bounds.
 */
export function rectForDrag(
  anchor: Point,
  pointer: Point,
  ratio: CropRatio,
  bounds: CropBounds
): CropRect {
  const dirX = pointer.x < anchor.x ? -1 : 1;
  const dirY = pointer.y < anchor.y ? -1 : 1;
  const availW = dirX < 0 ? anchor.x : bounds.width - anchor.x;
  const availH = dirY < 0 ? anchor.y : bounds.height - anchor.y;

  let width: number;
  let height: number;

  if (ratio) {
    const fromX = Math.abs(pointer.x - anchor.x);
    const fromY = Math.abs(pointer.y - anchor.y) * (ratio.w / ratio.h);
    const maxW = Math.min(availW, availH * (ratio.w / ratio.h));
    width = Math.max(1, Math.floor(Math.min(fromX, fromY, maxW)));
    height = Math.max(1, Math.round((width * ratio.h) / ratio.w));
    if (height > availH) {
      height = Math.max(1, Math.floor(availH));
      width = Math.max(1, Math.round((height * ratio.w) / ratio.h));
    }
  } else {
    width = Math.max(1, Math.min(Math.abs(pointer.x - anchor.x), availW));
    height = Math.max(1, Math.min(Math.abs(pointer.y - anchor.y), availH));
  }

  const x = dirX < 0 ? anchor.x - width : anchor.x;
  const y = dirY < 0 ? anchor.y - height : anchor.y;
  return clampRect({ x, y, width, height }, bounds.width, bounds.height);
}

/** Adjust one edge of `rect` to `pointer` (free resize only). */
export function rectForEdgeDrag(
  rect: CropRect,
  edge: "n" | "e" | "s" | "w",
  pointer: Point,
  bounds: CropBounds
): CropRect {
  let { x, y, width, height } = rect;
  switch (edge) {
    case "n": {
      const bottom = y + height;
      y = clampInt(pointer.y, 0, bottom - 1);
      height = bottom - y;
      break;
    }
    case "s": {
      const top = y;
      height = clampInt(pointer.y, top + 1, bounds.height) - top;
      break;
    }
    case "w": {
      const right = x + width;
      x = clampInt(pointer.x, 0, right - 1);
      width = right - x;
      break;
    }
    case "e": {
      const left = x;
      width = clampInt(pointer.x, left + 1, bounds.width) - left;
      break;
    }
  }
  return clampRect({ x, y, width, height }, bounds.width, bounds.height);
}
