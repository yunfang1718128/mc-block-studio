import { describe, expect, it } from "vitest";
import { encodeMcvox, isOccupied, parseMcvox, surfaceColor, type McvoxCapture } from "./mcvox";

function makeCapture(): McvoxCapture {
  const sizeX = 2;
  const sizeY = 1;
  const sizeZ = 1;
  const occupancy = new Uint8Array(1);
  occupancy[0] = 0b11; // both voxels occupied
  const colors = new Uint8Array(sizeX * sizeY * sizeZ * 4);
  // voxel 0: red surface
  colors[0] = 255;
  colors[1] = 0;
  colors[2] = 0;
  colors[3] = 255;
  // voxel 1: occupied but hidden (no colour)
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

describe("mcvox", () => {
  it("round-trips a capture through encode/parse", () => {
    const capture = makeCapture();
    const parsed = parseMcvox(encodeMcvox(capture));
    expect(parsed.sizeX).toBe(2);
    expect(parsed.header.entityId).toBe("minecraft:test");
    expect(isOccupied(parsed, 0, 0, 0)).toBe(true);
    expect(isOccupied(parsed, 1, 0, 0)).toBe(true);
    expect(surfaceColor(parsed, 0, 0, 0)).toEqual([255, 0, 0]);
    expect(surfaceColor(parsed, 1, 0, 0)).toBeNull();
  });

  it("round-trips a compressed capture", () => {
    const parsed = parseMcvox(encodeMcvox(makeCapture(), { compress: true }));
    expect(parsed.header.dimensions).toEqual([2, 1, 1]);
    expect(isOccupied(parsed, 1, 0, 0)).toBe(true);
  });

  it("rejects a bad magic header", () => {
    const bytes = encodeMcvox(makeCapture());
    bytes[0] = 0x00;
    expect(() => parseMcvox(bytes)).toThrow(/文件头/);
  });

  it("rejects a truncated file", () => {
    expect(() => parseMcvox(new Uint8Array(4))).toThrow(/过短/);
  });

  it("rejects a payload length mismatch", () => {
    const bytes = encodeMcvox(makeCapture());
    expect(() => parseMcvox(bytes.subarray(0, bytes.length - 1))).toThrow(/长度不符/);
  });
});
