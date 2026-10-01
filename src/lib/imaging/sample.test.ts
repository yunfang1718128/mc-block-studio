import { describe, expect, it } from "vitest";
import {
  analyzeComplexity,
  sampleAverage,
  sampleImage,
  sampleLanczos,
  sampleMedian,
  sampleNearest,
  type ImageSource,
} from "./sample";

type Pixel = [number, number, number, number];

function image(width: number, height: number, at: (x: number, y: number) => Pixel): ImageSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = at(x, y);
      const o = (y * width + x) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a;
    }
  }
  return { data, width, height };
}

describe("sampleNearest", () => {
  it("picks the top-left pixel of each cell", () => {
    const src = image(2, 2, (x) => (x === 0 ? [10, 20, 30, 255] : [40, 50, 60, 255]));
    expect(sampleNearest(src, 2, 1)).toEqual([
      [10, 20, 30],
      [40, 50, 60],
    ]);
  });
});

describe("sampleAverage", () => {
  it("averages each source region", () => {
    const src = image(4, 4, (x) => (x < 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    expect(sampleAverage(src, 2, 1)).toEqual([
      [0, 0, 0],
      [255, 255, 255],
    ]);
  });
});

describe("sampleMedian", () => {
  it("ignores a single outlier in the region", () => {
    const src = image(3, 3, (x, y) => (x === 2 && y === 2 ? [200, 0, 0, 255] : [10, 0, 0, 255]));
    expect(sampleMedian(src, 1, 1)).toEqual([[10, 0, 0]]);
    expect(sampleAverage(src, 1, 1)).toEqual([[31, 0, 0]]);
  });
});

describe("sampleLanczos", () => {
  it("leaves a constant image unchanged", () => {
    const src = image(8, 8, () => [40, 80, 120, 255]);
    const out = sampleLanczos(src, 4, 4);
    expect(out).toHaveLength(16);
    for (const c of out) expect(c).toEqual([40, 80, 120]);
  });
});

describe("transparency", () => {
  it("maps fully transparent cells to air", () => {
    const src = image(2, 2, () => [0, 0, 0, 0]);
    expect(sampleNearest(src, 2, 2)).toEqual([null, null, null, null]);
  });

  it("keeps opaque cells", () => {
    const src = image(1, 1, () => [12, 34, 56, 255]);
    expect(sampleNearest(src, 1, 1)).toEqual([[12, 34, 56]]);
  });
});

describe("analyzeComplexity", () => {
  it("recommends average for a flat image", () => {
    const src = image(8, 8, () => [100, 150, 200, 255]);
    expect(analyzeComplexity(src).recommended).toBe("average");
  });

  it("recommends nearest for a hard-edged checkerboard", () => {
    const src = image(16, 16, (x, y) => ((x + y) % 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    expect(analyzeComplexity(src).recommended).toBe("nearest");
  });

  it("recommends lanczos for a smooth gradient", () => {
    const src = image(32, 32, (x) => {
      const v = Math.round((x / 31) * 255);
      return [v, v, v, 255];
    });
    expect(analyzeComplexity(src).recommended).toBe("lanczos");
  });
});

describe("sampleImage", () => {
  it("resolves auto to the recommended algorithm", () => {
    const src = image(8, 8, () => [7, 8, 9, 255]);
    expect(sampleImage(src, 2, 2, "auto")).toEqual([
      [7, 8, 9], [7, 8, 9], [7, 8, 9], [7, 8, 9],
    ]);
  });
});
