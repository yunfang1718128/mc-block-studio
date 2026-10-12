import { describe, expect, it } from "vitest";
import {
  SCALE_LADDER,
  SCALE_MAX_INDEX,
  SCALE_MIN_INDEX,
  isShrink,
  scaleLabel,
  scaleStepFor,
  symmetricPartition,
} from "./scale-ladder";

describe("SCALE_LADDER", () => {
  it("runs from 1/4× up to 12× with 1× in the middle", () => {
    expect(SCALE_LADDER[SCALE_MIN_INDEX]).toEqual({ num: 1, den: 4 });
    expect(SCALE_LADDER[3]).toEqual({ num: 1, den: 1 });
    expect(SCALE_LADDER[SCALE_MAX_INDEX]).toEqual({ num: 12, den: 1 });
  });

  it("increases strictly in value from index to index", () => {
    const value = (i: number) => SCALE_LADDER[i].num / SCALE_LADDER[i].den;
    for (let i = 1; i < SCALE_LADDER.length; i++) {
      expect(value(i)).toBeGreaterThan(value(i - 1));
    }
  });
});

describe("scaleStepFor", () => {
  it("clamps out-of-range and fractional indices", () => {
    expect(scaleStepFor(-5)).toEqual({ num: 1, den: 4 });
    expect(scaleStepFor(99)).toEqual({ num: 12, den: 1 });
    expect(scaleStepFor(4.4)).toEqual(SCALE_LADDER[4]);
    expect(scaleStepFor(4.6)).toEqual(SCALE_LADDER[5]);
  });
});

describe("scaleLabel", () => {
  it("formats shrink steps as fractions and expand steps as integers", () => {
    expect(scaleLabel({ num: 1, den: 4 })).toBe("1/4×");
    expect(scaleLabel({ num: 1, den: 3 })).toBe("1/3×");
    expect(scaleLabel({ num: 1, den: 1 })).toBe("1×");
    expect(scaleLabel({ num: 12, den: 1 })).toBe("12×");
  });
});

describe("isShrink", () => {
  it("is true only below native resolution", () => {
    expect(isShrink({ num: 1, den: 2 })).toBe(true);
    expect(isShrink({ num: 1, den: 1 })).toBe(false);
    expect(isShrink({ num: 2, den: 1 })).toBe(false);
  });
});

describe("symmetricPartition", () => {
  it("splits leftovers across both ends instead of the last cell", () => {
    expect(symmetricPartition(16, 6)).toEqual([0, 3, 5, 8, 11, 13, 16]);
    expect(symmetricPartition(16, 4)).toEqual([0, 4, 8, 12, 16]);
  });

  it("produces mirror-symmetric widths with no empty cells", () => {
    for (const total of [1, 5, 12, 16, 17]) {
      for (let parts = 1; parts <= total; parts++) {
        const b = symmetricPartition(total, parts);
        expect(b[0]).toBe(0);
        expect(b[parts]).toBe(total);
        const widths = b.slice(1).map((v, i) => v - b[i]);
        expect(Math.min(...widths)).toBeGreaterThanOrEqual(1);
        if (parts % 2 === 0 && total % 2 === 1) {
          // One indivisible leftover pixel must go to one of the two centre
          // cells — everything outside that pair stays mirrored.
          const mid = parts / 2;
          expect(Math.abs(widths[mid - 1] - widths[mid])).toBeLessThanOrEqual(1);
          const left = widths.slice(0, mid - 1);
          const right = widths.slice(mid + 1);
          expect(left).toEqual([...right].reverse());
        } else {
          expect(widths).toEqual([...widths].reverse());
        }
      }
    }
  });
});
