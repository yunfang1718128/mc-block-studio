import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parse } from "prismarine-nbt";
import { createVoxelModel, setVoxel } from "../voxel/model";
import { bitsForPalette, encodeLitematic, encodeLitematicRaw, packBlockStates } from "./encode";

interface LooseTag {
  type: string;
  value: unknown;
}

describe("packBlockStates", () => {
  it("packs three-bit values inside a single long, LSB-first", () => {
    const longs = packBlockStates([0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2], 3);
    expect(longs).toHaveLength(1);
    // 0 | 1<<3 | 2<<6 | 3<<9 | 4<<12 | 5<<15 | 6<<18 | 7<<21 | 0<<24 | 1<<27 | 2<<30
    expect(longs[0]).toBe(2298136200n);
  });

  it("spans a value across a 64-bit word boundary", () => {
    const values = new Array<number>(14).fill(0);
    values[12] = 0b10101; // occupies bits 60..64 → low 4 bits in word 0, high bit in word 1
    values[13] = 0b111; // starts at bit 65
    const longs = packBlockStates(values, 5);
    expect(longs).toHaveLength(2);
    expect(longs[0]).toBe(0x5000000000000000n);
    expect(longs[1]).toBe(15n);
  });

  it("derives the bit width from the palette size", () => {
    expect(bitsForPalette(1)).toBe(1);
    expect(bitsForPalette(2)).toBe(1);
    expect(bitsForPalette(3)).toBe(2);
    expect(bitsForPalette(4)).toBe(2);
    expect(bitsForPalette(16)).toBe(4);
    expect(bitsForPalette(17)).toBe(5);
  });
});

describe("encodeLitematic", () => {
  it("produces a Litematica v6 tree that an independent parser accepts", async () => {
    const model = createVoxelModel(2, 1, 1);
    setVoxel(model, 0, 0, 0, { name: "minecraft:stone" });
    setVoxel(model, 1, 0, 0, { name: "minecraft:oak_log", properties: { axis: "y" } });

    const gz = encodeLitematic(model, { name: "test", timeCreated: 0, timeModified: 0 });
    const raw = gunzipSync(gz);
    const { parsed } = await parse(Buffer.from(raw));
    const root = parsed.value as unknown as Record<string, LooseTag>;

    expect((root.MinecraftDataVersion.value as number)).toBe(4903);
    expect((root.Version.value as number)).toBe(6);

    const metadata = root.Metadata.value as Record<string, LooseTag>;
    expect((metadata.RegionCount.value as number)).toBe(1);
    expect((metadata.EnclosingSize.value as Record<string, LooseTag>).x.value).toBe(2);

    const regions = root.Regions.value as Record<string, LooseTag>;
    const region = regions["mc-block-studio"].value as Record<string, LooseTag>;

    expect((region.Size.value as Record<string, LooseTag>).x.value).toBe(2);

    const palette = (region.BlockStatePalette.value as { value: Array<Record<string, LooseTag>> })
      .value;
    const names = palette.map((entry) => entry.Name.value);
    expect(names).toEqual(["minecraft:air", "minecraft:stone", "minecraft:oak_log"]);

    const logProps = palette[2].Properties.value as Record<string, LooseTag>;
    expect(logProps.axis.value).toBe("y");

    // bits = 2, length 2 → one long holding indices [1, 2] → 1 | (2 << 2) = 9
    const blockStates = (region.BlockStates.value as Array<[number, number]>).map(
      ([hi, lo]) => (BigInt(hi >>> 0) << 32n) | BigInt(lo >>> 0),
    );
    expect(blockStates).toEqual([9n]);
  });

  it("encodes without gzip when asked for the raw stream", async () => {
    const model = createVoxelModel(1, 1, 1);
    setVoxel(model, 0, 0, 0, { name: "minecraft:stone" });
    const raw = encodeLitematicRaw(model, { timeCreated: 0, timeModified: 0 });
    const { parsed } = await parse(Buffer.from(raw));
    const root = parsed.value as unknown as Record<string, LooseTag>;
    expect((root.Version.value as number)).toBe(6);
  });
});
