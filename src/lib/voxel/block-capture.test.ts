// A full-cube block capture and the built-in texture replica describe the same
// thing through two different pipelines. This pins that equivalence down: the
// block tab may switch between them without the user noticing a difference.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BLOCKS_BY_ID } from "@/lib/blocks";
import { buildPalette } from "@/lib/color/match";
import type { ImageSource } from "@/lib/imaging/sample";
import { buildBlockReplica, type ReplicaTextures } from "./from-block";
import { buildCapture } from "./from-capture";
import {
  captureIndex,
  captureSubject,
  parseMcvox,
  type McvoxCapture,
  type McvoxHeader,
} from "./mcvox";
import { nonAirCount, type VoxelModel } from "./model";
import { FACE_DIRS } from "@/lib/blocks/types";

const SIZE = 16;
const MAG = 2;
const RGB: [number, number, number] = [234, 236, 237];

/** A block-capture-like `.mcvox`: a full cube's surface, painted one colour. */
function makeCubeCapture(): McvoxCapture {
  const header: McvoxHeader = {
    formatVersion: 1,
    entityId: "minecraft:white_wool",
    entityName: "白色羊毛",
    mcVersion: "1.21.1",
    modLoader: "fabric",
    unitsPerBlock: SIZE,
    dimensions: [SIZE, SIZE, SIZE],
    solid: true,
    subject: "block",
    blockState: "white_wool",
  };
  const count = SIZE * SIZE * SIZE;
  const occupancy = new Uint8Array(Math.ceil(count / 8));
  const colors = new Uint8Array(count * 4);

  for (let y = 0; y < SIZE; y++) {
    for (let z = 0; z < SIZE; z++) {
      for (let x = 0; x < SIZE; x++) {
        const onBoundary =
          x === 0 || y === 0 || z === 0 || x === SIZE - 1 || y === SIZE - 1 || z === SIZE - 1;
        if (!onBoundary) continue;
        const i = captureIndex({ sizeX: SIZE, sizeY: SIZE, sizeZ: SIZE } as McvoxCapture, x, y, z);
        occupancy[i >> 3] |= 1 << (i & 7);
        const o = i * 4;
        colors[o] = RGB[0];
        colors[o + 1] = RGB[1];
        colors[o + 2] = RGB[2];
        colors[o + 3] = 255;
      }
    }
  }

  return { header, sizeX: SIZE, sizeY: SIZE, sizeZ: SIZE, occupancy, colors };
}

/** Six opaque 16×16 faces painted the same colour as the capture. */
function makeTextures(): ReplicaTextures {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    data[i * 4] = RGB[0];
    data[i * 4 + 1] = RGB[1];
    data[i * 4 + 2] = RGB[2];
    data[i * 4 + 3] = 255;
  }
  const face: ImageSource = { data, width: SIZE, height: SIZE };
  return Object.fromEntries(FACE_DIRS.map((dir) => [dir, face])) as ReplicaTextures;
}

function shellCount(model: VoxelModel): number {
  return nonAirCount(model);
}

function isAirAt(model: VoxelModel, x: number, y: number, z: number): boolean {
  const air = model.palette.findIndex((state) => state.name === "minecraft:air");
  return model.indices[x + z * model.sizeX + y * model.sizeX * model.sizeZ] === air;
}

/** Non-air flags for every voxel sitting on one of the six outer layers. */
function outerLayer(model: VoxelModel): boolean[] {
  const { sizeX, sizeY, sizeZ } = model;
  const out: boolean[] = [];
  for (let y = 0; y < sizeY; y++) {
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const onBoundary =
          x === 0 || y === 0 || z === 0 || x === sizeX - 1 || y === sizeY - 1 || z === sizeZ - 1;
        if (onBoundary) out.push(!isAirAt(model, x, y, z));
      }
    }
  }
  return out;
}

describe("block capture vs built-in block replica", () => {
  const palette = buildPalette([BLOCKS_BY_ID.get("white_wool")!]);

  it("are the same model at 1× magnification", () => {
    const fromCapture = buildCapture(makeCubeCapture(), palette, {
      magnification: 1,
      interior: "hollow",
      cull: true,
    }).model;
    const fromTextures = buildBlockReplica(makeTextures(), palette, { magnification: 1 });
    expect(fromCapture.sizeX).toBe(fromTextures.sizeX);
    expect(shellCount(fromCapture)).toBe(shellCount(fromTextures));
    expect(outerLayer(fromCapture)).toEqual(outerLayer(fromTextures));
  });

  /**
   * At 2× they are not the same model any more — deliberately so. A capture
   * expands every native voxel into an N³ block of voxels, so its shell comes
   * out N blocks thick, while the texture replica only ever paints the outer
   * layer. From outside the two are indistinguishable, which is what this
   * pins down; the extra inner layers are the capture pipeline's normal
   * behaviour (mob captures work the same way).
   */
  it("are indistinguishable from outside at 2× magnification", () => {
    const fromCapture = buildCapture(makeCubeCapture(), palette, {
      magnification: MAG,
      interior: "hollow",
      cull: true,
    });
    const fromTextures = buildBlockReplica(makeTextures(), palette, { magnification: MAG });

    expect(fromCapture.model.sizeX).toBe(SIZE * MAG);
    expect(fromCapture.model.sizeY).toBe(fromTextures.sizeY);
    expect(fromCapture.model.sizeZ).toBe(fromTextures.sizeZ);
    expect(outerLayer(fromCapture.model)).toEqual(outerLayer(fromTextures));

    // …but the capture's wall is MAG blocks thick instead of one.
    const singleLayerShell = 6 * (SIZE * MAG) ** 2 - 12 * (SIZE * MAG) + 8;
    expect(shellCount(fromTextures)).toBe(singleLayerShell);
    expect(shellCount(fromCapture.model)).toBeGreaterThan(singleLayerShell);
  });

  it("leaves the interior empty when hollowing a block capture", () => {
    const { model } = buildCapture(makeCubeCapture(), palette, {
      magnification: MAG,
      interior: "hollow",
      cull: true,
    });
    const side = SIZE * MAG;
    const air = model.palette.findIndex((state) => state.name === "minecraft:air");
    const centre = (model.indices[
      side * side * Math.floor(side / 2) + Math.floor(side / 2) * side + Math.floor(side / 2)
    ] as number) as number;
    expect(centre).toBe(air);
  });

  it("fills the interior when asked for a solid block capture", () => {
    const hollow = buildCapture(makeCubeCapture(), palette, {
      magnification: MAG,
      interior: "hollow",
      cull: true,
    }).model;
    const filled = buildCapture(makeCubeCapture(), palette, {
      magnification: MAG,
      interior: "fill",
      cull: true,
      filler: { name: "minecraft:stone" },
    }).model;
    expect(shellCount(filled)).toBe(SIZE * MAG * SIZE * MAG * SIZE * MAG);
    expect(shellCount(filled)).toBeGreaterThan(shellCount(hollow));
  });

  // `pnpm sample:block` writes this; it is gitignored, so tolerate its absence.
  const samplePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../sample-block-stairs.mcvox"
  );
  it.skipIf(!existsSync(samplePath))("reads the generated staircase sample", () => {
    const capture = parseMcvox(new Uint8Array(readFileSync(samplePath)));
    expect(captureSubject(capture.header)).toBe("block");
    expect(capture.header.blockState).toContain("oak_stairs[");
    expect([capture.sizeX, capture.sizeY, capture.sizeZ]).toEqual([SIZE, SIZE, SIZE]);

    const { model } = buildCapture(capture, palette, {
      magnification: 1,
      interior: "hollow",
      cull: true,
    });
    // The non-cube silhouette survives: nothing stands above the missing half,
    // while the step's top face and the lower slab's exposed top are solid.
    expect(isAirAt(model, 12, 15, 12)).toBe(true);
    expect(isAirAt(model, 12, 15, 3)).toBe(false);
    expect(isAirAt(model, 12, 7, 12)).toBe(false);
  });
});
