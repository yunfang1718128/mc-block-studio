import { blockForState } from "../blocks";
import type { BlockInfo } from "../blocks/types";
import { isAir, voxelIndex, type VoxelModel } from "./model";

export interface BlockInfoWithName {
  /** `minecraft:<id>` state name, the model's palette key. */
  name: string;
  block: BlockInfo;
}

export interface VoxelGroup extends BlockInfoWithName {
  /**
   * Flat `x, y, z` triples for every voxel of this block type, in model order.
   * A single `Float32Array` keeps the 3-D scene cheap to rebuild.
   */
  coords: Float32Array;
}

/**
 * Bucket the model's non-air voxels by block type so the 3-D viewer can render
 * one `InstancedMesh` per type. Voxels whose state is not in the catalogue are
 * dropped — the viewer cannot texture them.
 */
export function groupVoxelsByBlock(model: VoxelModel): VoxelGroup[] {
  const { sizeX, sizeY, sizeZ } = model;
  const buckets = new Map<string, { block: BlockInfo; coords: number[] }>();

  for (let y = 0; y < sizeY; y++) {
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const state = model.palette[model.indices[voxelIndex(sizeX, sizeZ, x, y, z)]];
        if (isAir(state)) continue;
        let bucket = buckets.get(state.name);
        if (!bucket) {
          const block = blockForState(state.name);
          if (!block) continue;
          bucket = { block, coords: [] };
          buckets.set(state.name, bucket);
        }
        bucket.coords.push(x, y, z);
      }
    }
  }

  return [...buckets].map(([name, { block, coords }]) => ({
    name,
    block,
    coords: Float32Array.from(coords),
  }));
}

/** Unique texture basenames referenced by a set of groups. */
export function textureNamesForGroups(groups: readonly VoxelGroup[]): string[] {
  const names = new Set<string>();
  for (const group of groups) {
    for (const name of Object.values(group.block.faces)) names.add(name);
  }
  return [...names];
}
