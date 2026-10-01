import { describe, expect, it } from "vitest";
import { deltaE, srgbToLab } from "./lab";

describe("srgbToLab", () => {
  it("maps white to L*=100 with neutral chroma", () => {
    const { l, a, b } = srgbToLab([255, 255, 255]);
    expect(l).toBeCloseTo(100, 1);
    expect(a).toBeCloseTo(0, 1);
    expect(b).toBeCloseTo(0, 1);
  });

  it("maps black to the origin", () => {
    expect(srgbToLab([0, 0, 0])).toEqual({ l: 0, a: 0, b: 0 });
  });

  it("matches the reference value for pure red", () => {
    const { l, a, b } = srgbToLab([255, 0, 0]);
    expect(l).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 1);
    expect(b).toBeCloseTo(67.2, 1);
  });

  it("gives mid grey a positive lightness and near-zero chroma", () => {
    const { l, a, b } = srgbToLab([128, 128, 128]);
    expect(l).toBeCloseTo(53.59, 1);
    expect(Math.abs(a)).toBeLessThan(0.5);
    expect(Math.abs(b)).toBeLessThan(0.5);
  });
});

describe("deltaE", () => {
  it("is zero for identical colours", () => {
    expect(deltaE(srgbToLab([12, 34, 56]), srgbToLab([12, 34, 56]))).toBeCloseTo(0, 6);
  });

  it("grows with perceptual distance", () => {
    const grey = srgbToLab([128, 128, 128]);
    const near = srgbToLab([130, 128, 128]);
    const far = srgbToLab([255, 0, 0]);
    expect(deltaE(grey, near)).toBeLessThan(deltaE(grey, far));
  });
});
