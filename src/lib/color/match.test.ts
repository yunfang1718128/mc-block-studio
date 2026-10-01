import { describe, expect, it } from "vitest";
import type { BlockInfo } from "../blocks/types";
import { buildPalette, matchColor, matchGrid } from "./match";

function block(id: string, rgb: [number, number, number]): BlockInfo {
  return {
    id,
    name: id,
    category: "test",
    kind: "solid",
    rgb,
    variance: 0,
    alpha: 255,
    faces: { north: id, south: id, east: id, west: id, top: id, bottom: id },
  };
}

const palette = buildPalette([
  block("black", [0, 0, 0]),
  block("white", [255, 255, 255]),
  block("red", [255, 0, 0]),
  block("green", [0, 255, 0]),
]);

describe("matchColor", () => {
  it("returns the exact block for an identical colour", () => {
    expect(matchColor([255, 0, 0], palette)?.id).toBe("red");
  });

  it("returns the perceptually nearest block", () => {
    expect(matchColor([240, 10, 10], palette)?.id).toBe("red");
    expect(matchColor([20, 20, 20], palette)?.id).toBe("black");
  });

  it("respects a restricted palette rather than widening its search", () => {
    const restricted = buildPalette([block("green", [0, 255, 0]), block("blue", [0, 0, 255])]);
    expect(matchColor([10, 10, 220], restricted)?.id).toBe("blue");
  });

  it("returns null for an empty palette", () => {
    expect(matchColor([1, 2, 3], [])).toBeNull();
  });
});

describe("matchGrid", () => {
  it("matches every cell and preserves transparent samples as null", () => {
    const grid = matchGrid([[255, 0, 0], null, [0, 255, 0]], palette);
    expect(grid.map((b) => b?.id ?? null)).toEqual(["red", null, "green"]);
  });
});
