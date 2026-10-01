import { describe, expect, it } from "vitest";
import {
  clampRect,
  cropImageSource,
  isFullCrop,
  largestRectForRatio,
  rectForDrag,
  rectForEdgeDrag,
} from "./crop";
import { sampleNearest, type ImageSource } from "./sample";

/** A 3×2 image where pixel (x, y) is encoded in the red channel. */
function source(): ImageSource {
  const data = new Uint8ClampedArray(3 * 2 * 4);
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 3; x++) {
      const o = (y * 3 + x) * 4;
      data[o] = y * 3 + x;
      data[o + 3] = 255;
    }
  }
  return { data, width: 3, height: 2 };
}

describe("clampRect", () => {
  it("rounds and keeps a rectangle inside the bounds", () => {
    expect(clampRect({ x: 2.4, y: -3, width: 10, height: 0 }, 8, 8)).toEqual({
      x: 2,
      y: 0,
      width: 6,
      height: 1,
    });
  });

  it("shrinks an overflowing rectangle from its top-left corner", () => {
    expect(clampRect({ x: 6, y: 6, width: 4, height: 4 }, 8, 8)).toEqual({
      x: 6,
      y: 6,
      width: 2,
      height: 2,
    });
  });
});

describe("cropImageSource", () => {
  it("copies the requested sub-rectangle with correct dimensions", () => {
    const out = cropImageSource(source(), { x: 1, y: 1, width: 2, height: 1 });
    expect(out.width).toBe(2);
    expect(out.height).toBe(1);
    expect([...out.data]).toEqual([4, 0, 0, 255, 5, 0, 0, 255]);
  });

  it("clamps an out-of-bounds rectangle instead of throwing", () => {
    const out = cropImageSource(source(), { x: 2, y: 1, width: 99, height: 99 });
    expect(out.width).toBe(1);
    expect(out.height).toBe(1);
    expect(out.data[0]).toBe(5);
  });

  it("feeds only the cropped pixels into the sampler", () => {
    const data = new Uint8ClampedArray(4 * 2 * 4);
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 4; x++) {
        const o = (y * 4 + x) * 4;
        data[o] = x < 2 ? 255 : 0;
        data[o + 2] = x < 2 ? 0 : 255;
        data[o + 3] = 255;
      }
    }
    const cropped = cropImageSource({ data, width: 4, height: 2 }, { x: 2, y: 0, width: 2, height: 2 });
    expect(sampleNearest(cropped, 1, 1)[0]).toEqual([0, 0, 255]);
  });
});

describe("largestRectForRatio", () => {
  it("fills a matching square", () => {
    expect(largestRectForRatio({ width: 100, height: 100 }, { w: 1, h: 1 })).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  });

  it("centres the largest 1:2 rectangle", () => {
    expect(largestRectForRatio({ width: 100, height: 50 }, { w: 1, h: 2 })).toEqual({
      x: 38,
      y: 0,
      width: 25,
      height: 50,
    });
  });

  it("never returns a zero dimension", () => {
    const rect = largestRectForRatio({ width: 2, height: 2 }, { w: 1, h: 3 });
    expect(rect.width).toBeGreaterThanOrEqual(1);
    expect(rect.height).toBeGreaterThanOrEqual(1);
  });
});

describe("isFullCrop", () => {
  it("detects the full image", () => {
    expect(isFullCrop({ x: 0, y: 0, width: 3, height: 2 }, { width: 3, height: 2 })).toBe(true);
    expect(isFullCrop({ x: 0, y: 0, width: 2, height: 2 }, { width: 3, height: 2 })).toBe(false);
  });
});

describe("rectForDrag", () => {
  const bounds = { width: 100, height: 100 };

  it("resizes freely from a fixed corner", () => {
    expect(rectForDrag({ x: 0, y: 0 }, { x: 10, y: 20 }, null, bounds)).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 20,
    });
  });

  it("resizes in the negative direction", () => {
    expect(rectForDrag({ x: 50, y: 50 }, { x: 30, y: 40 }, null, bounds)).toEqual({
      x: 30,
      y: 40,
      width: 20,
      height: 10,
    });
  });

  it("honours a 1:1 ratio on the constraining axis", () => {
    expect(rectForDrag({ x: 0, y: 0 }, { x: 50, y: 30 }, { w: 1, h: 1 }, bounds)).toEqual({
      x: 0,
      y: 0,
      width: 30,
      height: 30,
    });
  });

  it("honours a 1:2 ratio", () => {
    expect(rectForDrag({ x: 0, y: 0 }, { x: 50, y: 100 }, { w: 1, h: 2 }, bounds)).toEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 100,
    });
  });

  it("never exceeds the bounds", () => {
    expect(rectForDrag({ x: 0, y: 0 }, { x: 200, y: 200 }, null, { width: 50, height: 50 })).toEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
  });
});

describe("rectForEdgeDrag", () => {
  const bounds = { width: 100, height: 100 };

  it("moves the north edge without touching the bottom", () => {
    expect(rectForEdgeDrag({ x: 10, y: 10, width: 40, height: 40 }, "n", { x: 0, y: 25 }, bounds)).toEqual({
      x: 10,
      y: 25,
      width: 40,
      height: 25,
    });
  });

  it("keeps at least one pixel on the east edge", () => {
    expect(rectForEdgeDrag({ x: 10, y: 10, width: 40, height: 40 }, "e", { x: 5, y: 0 }, bounds)).toEqual({
      x: 10,
      y: 10,
      width: 1,
      height: 40,
    });
  });
});
