// Generates a hand-made `.mcvox` sample so the studio's mob mode can be tested
// before the capture mod exists. Run: `pnpm sample:capture`.
//
// The figure is a blocky humanoid in a 16 x 34 x 16 native grid with a single
// shaded colour per body part. Interior voxels carry no colour, exactly like a
// real capture; the studio decides hollow/fill.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SX = 16;
const SY = 34;
const SZ = 16;

const boxes = [
  { from: [4, 24, 4], to: [12, 32, 12], color: [104, 196, 104] }, // head
  { from: [4, 12, 4], to: [12, 24, 12], color: [74, 160, 74] }, // body
  { from: [4, 0, 4], to: [8, 12, 12], color: [58, 128, 58] }, // left leg
  { from: [8, 0, 4], to: [12, 12, 12], color: [58, 128, 58] }, // right leg
];

const index = (x, y, z) => x + z * SX + y * SX * SZ;
const count = SX * SY * SZ;
const occupancy = new Uint8Array(count);
const partColor = new Int16Array(count).fill(-1);

boxes.forEach((box, boxIndex) => {
  for (let y = box.from[1]; y < box.to[1]; y++) {
    for (let z = box.from[2]; z < box.to[2]; z++) {
      for (let x = box.from[0]; x < box.to[0]; x++) {
        const i = index(x, y, z);
        occupancy[i] = 1;
        partColor[i] = boxIndex;
      }
    }
  }
});

const occupied = (x, y, z) =>
  x >= 0 && y >= 0 && z >= 0 && x < SX && y < SY && z < SZ && occupancy[index(x, y, z)] === 1;

const colors = new Uint8Array(count * 4);
for (let y = 0; y < SY; y++) {
  for (let z = 0; z < SZ; z++) {
    for (let x = 0; x < SX; x++) {
      const i = index(x, y, z);
      if (occupancy[i] !== 1) continue;
      const exposed =
        !occupied(x + 1, y, z) ||
        !occupied(x - 1, y, z) ||
        !occupied(x, y + 1, z) ||
        !occupied(x, y - 1, z) ||
        !occupied(x, y, z + 1) ||
        !occupied(x, y, z - 1);
      if (!exposed) continue; // hidden interior keeps no colour
      const [r, g, b] = boxes[partColor[i]].color;
      colors[i * 4] = r;
      colors[i * 4 + 1] = g;
      colors[i * 4 + 2] = b;
      colors[i * 4 + 3] = 255;
    }
  }
}

// Surface occupancy just marks every model voxel; the colour layer decides what
// is visible.
const occBytes = new Uint8Array(Math.ceil(count / 8));
for (let i = 0; i < count; i++) {
  if (occupancy[i] === 1) occBytes[i >> 3] |= 1 << (i & 7);
}

const header = {
  formatVersion: 1,
  entityId: "minecraft:sample_humanoid",
  entityName: "Sample Humanoid",
  mcVersion: "1.21.1",
  modLoader: "fabric",
  unitsPerBlock: 16,
  dimensions: [SX, SY, SZ],
  solid: true,
  animatedTick: 0,
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
const target = join(root, "..", "sample-humanoid.mcvox");
writeFileSync(target, out);
console.log(`Wrote ${target} (${out.length} bytes, ${SX}x${SY}x${SZ})`);
