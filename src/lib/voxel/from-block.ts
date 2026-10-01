import type { FaceDir } from "../blocks/types";
import { matchColor, type PaletteEntry } from "../color/match";
import type { ImageSource } from "../imaging/sample";
import { createVoxelModel, setVoxel, type BlockState, type VoxelModel } from "./model";
import { toBlockState } from "./from-image";

/** One texture image per cube face. */
export type ReplicaTextures = Record<FaceDir, ImageSource>;

export interface ReplicaOptions {
  /** How many blocks each texture pixel becomes. */
  magnification: number;
}

const FACES: readonly FaceDir[] = ["north", "south", "east", "west", "top", "bottom"];

/**
 * Build a hollow, magnified shell that reproduces a block's texture.
 *
 * The result is a `(textureSize * magnification)³` cube where only the outer
 * layer is filled — the interior is air. Each texture pixel becomes a
 * `magnification × magnification` patch of blocks chosen from `palette` by
 * nearest colour.
 */
export function buildBlockReplica(
  textures: ReplicaTextures,
  palette: readonly PaletteEntry[],
  options: ReplicaOptions
): VoxelModel {
  const n = Math.max(1, Math.floor(options.magnification));
  const t = textures.south.width;
  const s = t * n;

  const model = createVoxelModel(s, s, s);
  const cache = new Map<string, BlockState | null>();

  const resolve = (tx: number, ty: number, face: FaceDir): BlockState | null => {
    const src = textures[face];
    const sx = Math.min(tx, src.width - 1);
    const sy = Math.min(ty, src.height - 1);
    const o = (sy * src.width + sx) * 4;
    const a = src.data[o + 3];
    if (a < 32) return null;
    const key = `${src.data[o]},${src.data[o + 1]},${src.data[o + 2]}`;
    if (cache.has(key)) return cache.get(key)!;
    const block = matchColor([src.data[o], src.data[o + 1], src.data[o + 2]], palette);
    const state = block ? toBlockState(block) : null;
    cache.set(key, state);
    return state;
  };

  const position = (face: FaceDir, tx: number, ty: number, dx: number, dy: number): [number, number, number] => {
    const u = tx * n + dx;
    const v = ty * n + dy;
    switch (face) {
      case "top":
        return [u, s - 1, v];
      case "bottom":
        return [u, 0, s - 1 - v];
      case "south":
        return [u, s - 1 - v, s - 1];
      case "north":
        return [s - 1 - u, s - 1 - v, 0];
      case "east":
        return [s - 1, s - 1 - v, u];
      case "west":
        return [0, s - 1 - v, s - 1 - u];
    }
  };

  for (const face of FACES) {
    for (let ty = 0; ty < t; ty++) {
      for (let tx = 0; tx < t; tx++) {
        const state = resolve(tx, ty, face);
        if (!state) continue;
        for (let dy = 0; dy < n; dy++) {
          for (let dx = 0; dx < n; dx++) {
            const [x, y, z] = position(face, tx, ty, dx, dy);
            setVoxel(model, x, y, z, state);
          }
        }
      }
    }
  }

  return model;
}
