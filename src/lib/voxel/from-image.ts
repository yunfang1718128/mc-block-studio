import type { BlockInfo, FaceDir } from "../blocks/types";
import { matchColor, type PaletteEntry } from "../color/match";
import type { SampledColor } from "../imaging/sample";
import { AIR, createVoxelModel, setVoxel, type BlockState, type VoxelModel } from "./model";

export type Orientation = "wall" | "floor";

/**
 * Which block face is visible in the 2D preview for a given orientation:
 * a wall is viewed from the front (south), a floor from above (top).
 */
export function previewFaceFor(orientation: Orientation): FaceDir {
  return orientation === "wall" ? "south" : "top";
}

export interface FlatOptions {
  orientation: Orientation;
  /** Number of layers in the depth axis (1 = single layer). */
  thickness?: number;
}

/** Convert a Java block id into a namespaced block state. */
export function toBlockState(block: BlockInfo): BlockState {
  return { name: `minecraft:${block.id}` };
}

/**
 * Turn a sampled colour grid into a flat voxel model.
 *
 * - Wall: the image lies in the X-Y plane (sizeX = width, sizeY = height);
 *   the first row of the image is the top, matching Minecraft's +Y up.
 * - Floor: the image lies in the X-Z plane (sizeX = width, sizeZ = height).
 *
 * A `null` sample becomes air.
 */
export function buildFlatImage(
  colors: readonly SampledColor[],
  width: number,
  height: number,
  palette: readonly PaletteEntry[],
  options: FlatOptions
): VoxelModel {
  if (colors.length !== width * height) {
    throw new RangeError(`Expected ${width * height} samples, received ${colors.length}`);
  }

  const thickness = Math.max(1, options.thickness ?? 1);
  const wall = options.orientation === "wall";

  const model = wall
    ? createVoxelModel(width, height, thickness)
    : createVoxelModel(width, thickness, height);

  // Match each distinct colour once, not once per voxel.
  const cache = new Map<string, BlockState | null>();

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const color = colors[row * width + col];
      let state: BlockState | null;
      if (!color) {
        state = null;
      } else {
        const key = `${color[0]},${color[1]},${color[2]}`;
        if (cache.has(key)) state = cache.get(key)!;
        else {
          const block = matchColor(color, palette);
          state = block ? toBlockState(block) : null;
          cache.set(key, state);
        }
      }
      if (!state) continue;

      for (let d = 0; d < thickness; d++) {
        if (wall) {
          setVoxel(model, col, height - 1 - row, d, state);
        } else {
          setVoxel(model, col, d, row, state);
        }
      }
    }
  }

  // Guarantee the air entry exists for the encoder.
  if (!model.palette.includes(AIR)) model.palette.push(AIR);
  return model;
}
