import { describe, expect, it } from "vitest";
import type { BlockInfo } from "../blocks/types";
import { buildPalette } from "../color/match";
import type { ImageSource } from "../imaging/sample";
import { buildBlockReplica } from "./from-block";
import { buildReplicaFaceMap } from "./replica-map";
import { getVoxel, nonAirCount } from "./model";

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

function solid(size: number, rgb: [number, number, number]): ImageSource {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return { data, width: size, height: size };
}

const red = solid(16, [255, 0, 0]);
const blue = solid(16, [0, 0, 255]);
const green = solid(16, [0, 255, 0]);

const textures = { north: red, south: blue, east: red, west: red, top: blue, bottom: green };

describe("buildBlockReplica", () => {
  it("scales the cube by the magnification factor", () => {
    const model = buildBlockReplica(textures, palette, { scale: { num: 2, den: 1 } });
    expect([model.sizeX, model.sizeY, model.sizeZ]).toEqual([32, 32, 32]);
  });

  it("shrinks the cube to a stride-sampled shell", () => {
    const model = buildBlockReplica(textures, palette, { scale: { num: 1, den: 2 } });
    expect([model.sizeX, model.sizeY, model.sizeZ]).toEqual([8, 8, 8]);
    expect(getVoxel(model, 4, 4, 7).name).toBe("minecraft:blue"); // south
    expect(getVoxel(model, 4, 4, 0).name).toBe("minecraft:red"); // north
    expect(getVoxel(model, 4, 4, 4).name).toBe("minecraft:air"); // hollow
  });

  it("shrinks 1/4 to a 4³ cube", () => {
    const model = buildBlockReplica(textures, palette, { scale: { num: 1, den: 4 } });
    expect([model.sizeX, model.sizeY, model.sizeZ]).toEqual([4, 4, 4]);
  });

  it("keeps a mirror-symmetric texture mirror-symmetric when shrinking", () => {
    // Red columns at both ends, blue elsewhere: mirror-symmetric. Left-edge
    // stride sampling would read the outer red pixel for the first cell but
    // the inner blue one for the last; averaging whole cells does not.
    const data = new Uint8ClampedArray(16 * 16 * 4);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const rgb = x === 0 || x === 15 ? [255, 0, 0] : [0, 0, 255];
        const o = (y * 16 + x) * 4;
        data[o] = rgb[0];
        data[o + 1] = rgb[1];
        data[o + 2] = rgb[2];
        data[o + 3] = 255;
      }
    }
    const stripe: ImageSource = { data, width: 16, height: 16 };
    const mirrored = {
      north: stripe,
      south: stripe,
      east: stripe,
      west: stripe,
      top: stripe,
      bottom: stripe,
    };
    const model = buildBlockReplica(mirrored, palette, { scale: { num: 1, den: 2 } });
    const s = 8;
    for (let u = 0; u < s / 2; u++) {
      expect(getVoxel(model, u, s - 1, s - 1).name).toBe(
        getVoxel(model, s - 1 - u, s - 1, s - 1).name
      );
    }
  });

  it("assigns each face its own texture", () => {
    const model = buildBlockReplica(textures, palette, { scale: { num: 1, den: 1 } });
    expect(getVoxel(model, 8, 15, 8).name).toBe("minecraft:blue"); // top
    expect(getVoxel(model, 8, 0, 8).name).toBe("minecraft:green"); // bottom
    expect(getVoxel(model, 8, 8, 0).name).toBe("minecraft:red"); // north
    expect(getVoxel(model, 8, 8, 15).name).toBe("minecraft:blue"); // south
  });

  it("leaves the interior hollow", () => {
    const model = buildBlockReplica(textures, palette, { scale: { num: 1, den: 1 } });
    const s = 16;
    expect(getVoxel(model, 8, 8, 8).name).toBe("minecraft:air");
    // surface of a 16³ cube = 16³ − 14³
    expect(nonAirCount(model)).toBe(s * s * s - (s - 2) * (s - 2) * (s - 2));
  });
});

describe("buildReplicaFaceMap", () => {
  it("matches each face from its own texture", () => {
    const map = buildReplicaFaceMap(textures, palette);
    expect(map.size).toBe(16);
    expect(map.faces.top[0]?.id).toBe("blue");
    expect(map.faces.bottom[0]?.id).toBe("green");
    expect(map.faces.north[0]?.id).toBe("red");
    expect(map.faces.south[0]?.id).toBe("blue");
  });
});
