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
    const model = buildCaptureModel(single(), palette, { scale: { num: 1, den: 1 }, interior: "hollow" });
    expect([model.sizeX, model.sizeY, model.sizeZ]).toEqual([1, 1, 1]);
    expect(getVoxel(model, 0, 0, 0).name).toBe("minecraft:red");
  });

  it("expands each voxel by the magnification factor", () => {
    const model = buildCaptureModel(single(), palette, { scale: { num: 3, den: 1 }, interior: "hollow" });
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
    const model = buildCaptureModel(shell, palette, { scale: { num: 1, den: 1 }, interior: "hollow" });
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
      scale: { num: 1, den: 1 },
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
    const model = buildCaptureModel(solid, palette, { scale: { num: 1, den: 1 }, interior: "hollow" });
    expect(nonAirCount(model)).toBe(26);
    expect(getVoxel(model, 1, 1, 1).name).toBe("minecraft:air");
  });

  it("keeps hidden surface-coloured voxels when culling is off", () => {
    const solid = capture(3, 3, 3, () => ({ occupied: true, color: [255, 0, 0] }));
    const model = buildCaptureModel(solid, palette, {
      scale: { num: 1, den: 1 },
      interior: "hollow",
      cull: false,
    });
    expect(nonAirCount(model)).toBe(27);
    expect(getVoxel(model, 1, 1, 1).name).toBe("minecraft:red");
  });

  it("fills a solid interior with the filler when asked", () => {
    const solid = capture(3, 3, 3, () => ({ occupied: true, color: [255, 0, 0] }));
    const model = buildCaptureModel(solid, palette, {
      scale: { num: 1, den: 1 },
      interior: "fill",
      filler: { name: "minecraft:blue" },
    });
    expect(nonAirCount(model)).toBe(27);
    expect(getVoxel(model, 1, 1, 1).name).toBe("minecraft:blue");
  });

  it("rejects an over-large expansion", () => {
    expect(() =>
      buildCaptureModel(single(), palette, { scale: { num: 5000, den: 1 }, interior: "hollow" })
    ).toThrow(/体素过多/);
  });

  it("reports the layout without downsampling when the capture fits", () => {
    const built = buildCapture(single(), palette, { scale: { num: 1, den: 1 }, interior: "hollow" });
    expect(built.downsample).toBe(1);
    expect(getVoxel(built.model, 0, 0, 0).name).toBe("minecraft:red");
  });
});

describe("planCapture", () => {
  it("downsamples an oversized capture until it fits the budget", () => {
    const big = capture(8, 8, 8, () => ({ occupied: true, color: [255, 0, 0] }));
    const plan = planCapture(big, { num: 1, den: 1 }, 100);
    expect(plan.downsample).toBe(2);
    expect(plan.requestedDownsample).toBe(1);
    expect(plan.effectiveSize).toEqual([4, 4, 4]);
    expect(plan.volume).toBe(64);
  });

  it("throws when even a 1×1×1 capture cannot fit", () => {
    expect(() => planCapture(single(), { num: 5000, den: 1 })).toThrow(/体素过多/);
  });

  it("shrinks a 1/4 scale to its downsampled size", () => {
    const big = capture(16, 16, 16, () => ({ occupied: true, color: [255, 0, 0] }));
    const plan = planCapture(big, { num: 1, den: 4 });
    expect(plan.requestedDownsample).toBe(4);
    expect(plan.downsample).toBe(4);
    expect(plan.effectiveSize).toEqual([4, 4, 4]);
    expect(plan.modelSize).toEqual([4, 4, 4]);
  });

  it("rounds odd dimensions up when shrinking by 1/3", () => {
    const c = capture(16, 16, 16, () => ({ occupied: true, color: [255, 0, 0] }));
    const plan = planCapture(c, { num: 1, den: 3 });
    expect(plan.effectiveSize).toEqual([6, 6, 6]);
  });

  it("composes a requested shrink with a forced downsample", () => {
    const big = capture(9, 9, 9, () => ({ occupied: true, color: [255, 0, 0] }));
    const plan = planCapture(big, { num: 1, den: 2 }, 100);
    // 1/2 gives ceil(9/2)=5 → 5³=125 > 100, so it must shrink further to 1/3 → 27.
    expect(plan.requestedDownsample).toBe(2);
    expect(plan.downsample).toBe(3);
    expect(plan.volume).toBeLessThanOrEqual(100);
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

  it("keeps the first colour by default", () => {
    const src = capture(2, 1, 1, (x) =>
      x === 0 ? { occupied: true, color: [255, 0, 0] } : { occupied: true, color: [0, 0, 255] }
    );
    expect(surfaceColor(downsampleCapture(src, 2), 0, 0, 0)).toEqual([255, 0, 0]);
  });

  it("picks the majority colour when asked", () => {
    const src = capture(4, 1, 1, (x) =>
      x === 0 ? { occupied: true, color: [255, 0, 0] } : { occupied: true, color: [0, 0, 255] }
    );
    const out = downsampleCapture(src, 4, { color: "majority" });
    expect([out.sizeX, out.sizeY, out.sizeZ]).toEqual([1, 1, 1]);
    expect(surfaceColor(out, 0, 0, 0)).toEqual([0, 0, 255]);
  });

  it("breaks colour ties deterministically, not by scan order", () => {
    // One red and one blue voxel at equal distance from the cell centre: the
    // lower colour key (blue) wins, whatever direction the cell was scanned.
    const src = capture(2, 1, 1, (x) =>
      x === 0 ? { occupied: true, color: [255, 0, 0] } : { occupied: true, color: [0, 0, 255] }
    );
    const out = downsampleCapture(src, 2, { color: "majority" });
    expect(surfaceColor(out, 0, 0, 0)).toEqual([0, 0, 255]);
  });

  it("keeps a mirror-symmetric capture mirror-symmetric", () => {
    // 16 voxels downsampled by 3 split as widths [3,2,3,3,2,3]; red sits at
    // both ends, blue fills the rest. A fixed-stride grid would give the
    // width-1 trailing cell a different colour than its leading counterpart.
    const src = capture(16, 1, 1, (x) => ({
      occupied: true,
      color: x === 0 || x === 15 ? [255, 0, 0] : [0, 0, 255],
    }));
    const out = downsampleCapture(src, 3, { color: "majority" });
    expect(out.sizeX).toBe(6);
    for (let i = 0; i < 3; i++) {
      expect(surfaceColor(out, i, 0, 0)).toEqual(surfaceColor(out, 5 - i, 0, 0));
    }
  });

  it("keeps hidden interior voxels out of the colour vote", () => {
    // A solid 3×3×3 cube: only the centre voxel has no air neighbour. The
    // hidden blue centre and the exposed red top-face pixel tie on count,
    // and the centre one is nearer the cell centre — whole-volume voting
    // would pick blue even though a viewer only ever sees the red surface.
    const src = capture(3, 3, 3, (x, y, z) => {
      if (x === 1 && y === 1 && z === 1) return { occupied: true, color: [0, 0, 255] };
      if (x === 1 && y === 2 && z === 1) return { occupied: true, color: [255, 0, 0] };
      return { occupied: true };
    });
    const out = downsampleCapture(src, 3, { color: "majority" });
    expect(surfaceColor(out, 0, 0, 0)).toEqual([255, 0, 0]);
  });

  it("falls back to all voxels when a cell exposes nothing", () => {
    // A fully solid capture tinting only its buried centre must still get a
    // colour rather than empty.
    const src = capture(3, 3, 3, (x, y, z) =>
      x === 1 && y === 1 && z === 1
        ? { occupied: true, color: [0, 0, 255] }
        : { occupied: true }
    );
    const out = downsampleCapture(src, 3, { color: "majority" });
    expect(surfaceColor(out, 0, 0, 0)).toEqual([0, 0, 255]);
  });
});
