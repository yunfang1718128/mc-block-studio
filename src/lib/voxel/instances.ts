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

  // First pass: count voxels per block type and remember first-seen order.
  // Counting up front lets each group's Float32Array be allocated once, instead
  // of buffering every coordinate in a temporary JS array first.
  const counts = new Map<string, number>();
  const blocks = new Map<string, BlockInfo>();
  const order: string[] = [];

  for (let y = 0; y < sizeY; y++) {
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const state = model.palette[model.indices[voxelIndex(sizeX, sizeZ, x, y, z)]];
        if (isAir(state)) continue;
        const existing = counts.get(state.name);
        if (existing !== undefined) {
          counts.set(state.name, existing + 1);
          continue;
        }
        const block = blockForState(state.name);
        if (!block) continue;
        counts.set(state.name, 1);
        blocks.set(state.name, block);
        order.push(state.name);
      }
    }
  }

  const coords = new Map<string, Float32Array>();
  for (const name of order) coords.set(name, new Float32Array(counts.get(name)! * 3));
  const cursors = new Map<string, number>();

  // Second pass: fill the pre-sized arrays.
  for (let y = 0; y < sizeY; y++) {
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const state = model.palette[model.indices[voxelIndex(sizeX, sizeZ, x, y, z)]];
        if (isAir(state)) continue;
        const buffer = coords.get(state.name);
        if (!buffer) continue;
        const cursor = cursors.get(state.name) ?? 0;
        buffer[cursor] = x;
        buffer[cursor + 1] = y;
        buffer[cursor + 2] = z;
        cursors.set(state.name, cursor + 3);
      }
    }
  }

  return order.map((name) => ({ name, block: blocks.get(name)!, coords: coords.get(name)! }));
}

/** Unique texture basenames referenced by a set of groups. */
export function textureNamesForGroups(groups: readonly VoxelGroup[]): string[] {
  const names = new Set<string>();
  for (const group of groups) {
    for (const name of Object.values(group.block.faces)) names.add(name);
  }
  return [...names];
}
