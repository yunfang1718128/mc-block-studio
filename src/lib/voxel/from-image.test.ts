import { describe, expect, it } from "vitest";
import type { BlockInfo } from "../blocks/types";
import { buildPalette } from "../color/match";
import type { SampledColor } from "../imaging/sample";
import { buildFlatImage, previewFaceFor } from "./from-image";
import { getVoxel } from "./model";

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
  block("red", [255, 0, 0]),
  block("blue", [0, 0, 255]),
  block("green", [0, 255, 0]),
]);

const RED: SampledColor = [255, 0, 0];
const BLUE: SampledColor = [0, 0, 255];

describe("buildFlatImage", () => {
  it("lays a wall image out in X-Y with the first row on top", () => {
    const model = buildFlatImage([RED, BLUE], 2, 1, palette, { orientation: "wall" });
    expect([model.sizeX, model.sizeY, model.sizeZ]).toEqual([2, 1, 1]);
    expect(getVoxel(model, 0, 0, 0).name).toBe("minecraft:red");
    expect(getVoxel(model, 1, 0, 0).name).toBe("minecraft:blue");
  });

  it("puts image row 0 at the top of the wall", () => {
    const model = buildFlatImage([RED, BLUE], 1, 2, palette, { orientation: "wall" });
    expect(getVoxel(model, 0, 1, 0).name).toBe("minecraft:red");
    expect(getVoxel(model, 0, 0, 0).name).toBe("minecraft:blue");
  });

  it("lays a floor image out in X-Z", () => {
    const model = buildFlatImage([RED, BLUE], 2, 1, palette, { orientation: "floor" });
    expect([model.sizeX, model.sizeY, model.sizeZ]).toEqual([2, 1, 1]);
    expect(getVoxel(model, 0, 0, 0).name).toBe("minecraft:red");
    expect(getVoxel(model, 1, 0, 0).name).toBe("minecraft:blue");
  });

  it("repeats the image through the thickness axis", () => {
    const model = buildFlatImage([RED], 1, 1, palette, { orientation: "wall", thickness: 3 });
    expect(model.sizeZ).toBe(3);
    expect(getVoxel(model, 0, 0, 0).name).toBe("minecraft:red");
    expect(getVoxel(model, 0, 0, 2).name).toBe("minecraft:red");
  });

  it("maps transparent samples to air", () => {
    const model = buildFlatImage([null, BLUE], 2, 1, palette, { orientation: "wall" });
    expect(getVoxel(model, 0, 0, 0).name).toBe("minecraft:air");
    expect(getVoxel(model, 1, 0, 0).name).toBe("minecraft:blue");
  });

  it("rejects a sample count that does not match the grid", () => {
    expect(() => buildFlatImage([RED], 2, 2, palette, { orientation: "wall" })).toThrow(RangeError);
  });
});

describe("previewFaceFor", () => {
  it("shows the front face for a wall and the top face for a floor", () => {
    expect(previewFaceFor("wall")).toBe("south");
    expect(previewFaceFor("floor")).toBe("top");
  });
});
