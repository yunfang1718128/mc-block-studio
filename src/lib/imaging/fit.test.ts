import { describe, expect, it } from "vitest";
import { fitScale } from "./fit";

describe("fitScale", () => {
  it("keeps small art at 1:1 rather than magnifying", () => {
    expect(fitScale(1000, 1000, 200, 200)).toBe(1);
  });

  it("shrinks tall art to fit the height", () => {
    expect(fitScale(1000, 400, 300, 800)).toBeCloseTo(0.5);
  });

  it("shrinks wide art to fit the width", () => {
    expect(fitScale(400, 1000, 800, 300)).toBeCloseTo(0.5);
  });

  it("falls back to 1 before measurement", () => {
    expect(fitScale(0, 0, 300, 800)).toBe(1);
    expect(fitScale(500, 500, 0, 0)).toBe(1);
  });
});
