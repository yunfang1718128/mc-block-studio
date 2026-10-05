import { describe, expect, it } from "vitest";
import type { BlockInfo } from "../blocks/types";
import { buildPalette } from "../color/match";
import { buildCapture, buildCaptureModel, planCapture } from "./from-capture";
import { getVoxel, nonAirCount } from "./model";
import { downsampleCapture, isOccupied, surfaceColor, type McvoxCapture } from "./mcvox";

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
]);

function capture(
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  fill: (x: number, y: number, z: number) => { occupied: boolean; color?: [number, number, number] }
): McvoxCapture {
  const count = sizeX * sizeY * sizeZ;
  const occupancy = new Uint8Array(Math.ceil(count / 8));
  const colors = new Uint8Array(count * 4);
  for (let y = 0; y < sizeY; y++) {
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const i = x + z * sizeX + y * sizeX * sizeZ;
        const cell = fill(x, y, z);
        if (cell.occupied) occupancy[i >> 3] |= 1 << (i & 7);
        if (cell.color) {
          colors[i * 4] = cell.color[0];
          colors[i * 4 + 1] = cell.color[1];
          colors[i * 4 + 2] = cell.color[2];
          colors[i * 4 + 3] = 255;
        }
      }
    }
  }
  return {
    header: {
      formatVersion: 1,
      entityId: "minecraft:test",
      entityName: "Test",
      mcVersion: "1.21.1",
      modLoader: "fabric",
      unitsPerBlock: 16,
      dimensions: [sizeX, sizeY, sizeZ],
      solid: true,
    },
    sizeX,
    sizeY,
    sizeZ,
    occupancy,
    colors,
  };
}

const single = () => capture(1, 1, 1, () => ({ occupied: true, color: [255, 0, 0] }));

describe("buildCaptureModel", () => {
  it("maps a surface colour to a palette block", () => {
    const model = buildCaptureModel(single(), palette, { magnification: 1, interior: "hollow" });
    expect([model.sizeX, model.sizeY, model.sizeZ]).toEqual([1, 1, 1]);
    expect(getVoxel(model, 0, 0, 0).name).toBe("minecraft:red");
  });

  it("expands each voxel by the magnification factor", () => {
    const model = buildCaptureModel(single(), palette, { magnification: 3, interior: "hollow" });
    expect([model.sizeX, model.sizeY, model.sizeZ]).toEqual([3, 3, 3]);
    expect(nonAirCount(model)).toBe(27);
    expect(getVoxel(model, 2, 2, 2).name).toBe("minecraft:red");
  });

  it("keeps hidden interior air when hollow", () => {
    const shell = capture(3, 3, 3, (x, y, z) =>
      x === 1 && y === 1 && z === 1
        ? { occupied: true }
        : { occupied: true, color: [255, 0, 0] }
    );
    const model = buildCaptureModel(shell, palette, { magnification: 1, interior: "hollow" });
    // 27 voxels − 1 hidden centre
    expect(nonAirCount(model)).toBe(26);
    expect(getVoxel(model, 1, 1, 1).name).toBe("minecraft:air");
  });

  it("fills hidden interior with the filler block when asked", () => {
    const shell = capture(3, 3, 3, (x, y, z) =>
      x === 1 && y === 1 && z === 1
        ? { occupied: true }
        : { occupied: true, color: [255, 0, 0] }
    );
    const model = buildCaptureModel(shell, palette, {
      magnification: 1,
      interior: "fill",
      filler: { name: "minecraft:blue" },
    });
    expect(nonAirCount(model)).toBe(27);
    expect(getVoxel(model, 1, 1, 1).name).toBe("minecraft:blue");
  });

  it("culls hidden surface-coloured voxels by default", () => {
    // Real captures paint internal faces too, so every voxel of this cube
    // carries a colour even though only the 26 shell voxels are visible.
    const solid = capture(3, 3, 3, () => ({ occupied: true, color: [255, 0, 0] }));
    const model = buildCaptureModel(solid, palette, { magnification: 1, interior: "hollow" });
    expect(nonAirCount(model)).toBe(26);
    expect(getVoxel(model, 1, 1, 1).name).toBe("minecraft:air");
  });

  it("keeps hidden surface-coloured voxels when culling is off", () => {
    const solid = capture(3, 3, 3, () => ({ occupied: true, color: [255, 0, 0] }));
    const model = buildCaptureModel(solid, palette, {
      magnification: 1,
      interior: "hollow",
      cull: false,
    });
    expect(nonAirCount(model)).toBe(27);
    expect(getVoxel(model, 1, 1, 1).name).toBe("minecraft:red");
  });

  it("fills a solid interior with the filler when asked", () => {
    const solid = capture(3, 3, 3, () => ({ occupied: true, color: [255, 0, 0] }));
    const model = buildCaptureModel(solid, palette, {
      magnification: 1,
      interior: "fill",
      filler: { name: "minecraft:blue" },
    });
    expect(nonAirCount(model)).toBe(27);
    expect(getVoxel(model, 1, 1, 1).name).toBe("minecraft:blue");
  });

  it("rejects an over-large expansion", () => {
    expect(() =>
      buildCaptureModel(single(), palette, { magnification: 5000, interior: "hollow" })
    ).toThrow(/体素过多/);
  });

  it("reports the layout without downsampling when the capture fits", () => {
    const built = buildCapture(single(), palette, { magnification: 1, interior: "hollow" });
    expect(built.downsample).toBe(1);
    expect(getVoxel(built.model, 0, 0, 0).name).toBe("minecraft:red");
  });
});

describe("planCapture", () => {
  it("downsamples an oversized capture until it fits the budget", () => {
    const big = capture(8, 8, 8, () => ({ occupied: true, color: [255, 0, 0] }));
    const plan = planCapture(big, 1, 100);
    expect(plan.downsample).toBe(2);
    expect(plan.effectiveSize).toEqual([4, 4, 4]);
    expect(plan.volume).toBe(64);
  });

  it("throws when even a 1×1×1 capture cannot fit", () => {
    expect(() => planCapture(single(), 5000)).toThrow(/体素过多/);
  });
});

describe("downsampleCapture", () => {
  it("collapses a block that has any occupied voxel", () => {
    const src = capture(2, 2, 2, (x, y, z) =>
      x === 1 && y === 1 && z === 1 ? { occupied: true, color: [0, 0, 255] } : { occupied: false }
    );
    const out = downsampleCapture(src, 2);
    expect([out.sizeX, out.sizeY, out.sizeZ]).toEqual([1, 1, 1]);
    expect(isOccupied(out, 0, 0, 0)).toBe(true);
    expect(surfaceColor(out, 0, 0, 0)).toEqual([0, 0, 255]);
  });
});
