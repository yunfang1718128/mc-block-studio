import { describe, expect, it } from "vitest";
import { createVoxelModel, setVoxel } from "./model";
import { groupVoxelsByBlock, textureNamesForGroups } from "./instances";

describe("groupVoxelsByBlock", () => {
  it("buckets voxels by block type and drops air", () => {
    const model = createVoxelModel(2, 1, 2);
    setVoxel(model, 0, 0, 0, { name: "minecraft:stone" });
    setVoxel(model, 1, 0, 0, { name: "minecraft:stone" });
    setVoxel(model, 0, 0, 1, { name: "minecraft:oak_planks" });

    const groups = groupVoxelsByBlock(model);
    expect(groups).toHaveLength(2);
    const stone = groups.find((g) => g.name === "minecraft:stone");
    const planks = groups.find((g) => g.name === "minecraft:oak_planks");
    expect(stone?.coords.length).toBe(6);
    expect([...(stone?.coords ?? [])]).toEqual([0, 0, 0, 1, 0, 0]);
    expect([...(planks?.coords ?? [])]).toEqual([0, 0, 1]);
  });

  it("ignores states that are not in the catalogue", () => {
    const model = createVoxelModel(1, 1, 1);
    setVoxel(model, 0, 0, 0, { name: "minecraft:not_a_real_block" });
    expect(groupVoxelsByBlock(model)).toHaveLength(0);
  });
});

describe("textureNamesForGroups", () => {
  it("collects the unique face textures", () => {
    const model = createVoxelModel(1, 1, 1);
    setVoxel(model, 0, 0, 0, { name: "minecraft:stone" });
    const names = textureNamesForGroups(groupVoxelsByBlock(model));
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });
});
