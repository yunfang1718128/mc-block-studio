// Generates a hand-made block-capture `.mcvox` sample so the studio's block-mode
// upload source can be tested before the block-capture mod exists.
// Run: `pnpm sample:block`.
//
// The figure is a 16 x 16 x 16 native grid holding a staircase: the lower half
// is a full block, the upper half only covers one side. A real capture only
// paints voxels that have a face open to the outside, and this sample does the
// same.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SIZE = 16;

/** Voxel is part of the solid: a full lower slab plus one upper step. */
function filled(x, y, z) {
  if (y < 8) return true;
  return z < 8;
}

/** Two flat colours, so the step reads clearly in the 3D preview. */
function colorAt(y) {
  return y < 8 ? [162, 130, 78] : [186, 152, 96];
}

const index = (x, y, z) => x + z * SIZE + y * SIZE * SIZE;
const count = SIZE * SIZE * SIZE;
const occupancy = new Uint8Array(count);

for (let y = 0; y < SIZE; y++) {
  for (let z = 0; z < SIZE; z++) {
    for (let x = 0; x < SIZE; x++) {
      if (filled(x, y, z)) occupancy[index(x, y, z)] = 1;
    }
  }
}

const solid = (x, y, z) =>
  x >= 0 && y >= 0 && z >= 0 && x < SIZE && y < SIZE && z < SIZE && occupancy[index(x, y, z)] === 1;

const colors = new Uint8Array(count * 4);
for (let y = 0; y < SIZE; y++) {
  for (let z = 0; z < SIZE; z++) {
    for (let x = 0; x < SIZE; x++) {
      const i = index(x, y, z);
      if (occupancy[i] !== 1) continue;
      const exposed =
        !solid(x + 1, y, z) ||
        !solid(x - 1, y, z) ||
        !solid(x, y + 1, z) ||
        !solid(x, y - 1, z) ||
        !solid(x, y, z + 1) ||
        !solid(x, y, z - 1);
      if (!exposed) continue; // hidden interior keeps no colour
      const [r, g, b] = colorAt(y);
      colors[i * 4] = r;
      colors[i * 4 + 1] = g;
      colors[i * 4 + 2] = b;
      colors[i * 4 + 3] = 255;
    }
  }
}

const occBytes = new Uint8Array(Math.ceil(count / 8));
for (let i = 0; i < count; i++) {
  if (occupancy[i] === 1) occBytes[i >> 3] |= 1 << (i & 7);
}

const header = {
  formatVersion: 1,
  entityId: "minecraft:sample_stairs",
  entityName: "Sample Stairs",
  mcVersion: "1.21.1",
  modLoader: "fabric",
  unitsPerBlock: SIZE,
  dimensions: [SIZE, SIZE, SIZE],
  solid: true,
  subject: "block",
  blockState: "oak_stairs[facing=north,half=bottom,shape=straight]",
  generatedAt: new Date().toISOString(),
};

const headerJson = new TextEncoder().encode(JSON.stringify(header));
const payload = new Uint8Array(occBytes.length + colors.length);
payload.set(occBytes, 0);
payload.set(colors, occBytes.length);

const out = new Uint8Array(12 + headerJson.length + payload.length);
out.set([0x4d, 0x43, 0x56, 0x58], 0); // "MCVX"
out[4] = 1; // formatVersion
out[5] = 0; // flags: uncompressed
const view = new DataView(out.buffer);
view.setUint32(8, headerJson.length, true);
out.set(headerJson, 12);
out.set(payload, 12 + headerJson.length);

const root = dirname(fileURLToPath(import.meta.url));
const target = join(root, "..", "sample-block-stairs.mcvox");
writeFileSync(target, out);
console.log(`Wrote ${target} (${out.length} bytes, ${SIZE}x${SIZE}x${SIZE})`);
