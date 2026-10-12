import type { FaceDir, Rgb } from "../blocks/types";
import { matchColor, type PaletteEntry } from "../color/match";
import type { ImageSource } from "../imaging/sample";
import { createVoxelModel, setVoxel, type BlockState, type VoxelModel } from "./model";
import type { ScaleStep } from "./scale-ladder";
import { symmetricPartition } from "./scale-ladder";
import { toBlockState } from "./from-image";

/** One texture image per cube face. */
export type ReplicaTextures = Record<FaceDir, ImageSource>;

export interface ReplicaOptions {
  /** Scale as an exact rational: num>1 expands each pixel, den>1 shrinks it. */
  scale: ScaleStep;
}

const FACES: readonly FaceDir[] = ["north", "south", "east", "west", "top", "bottom"];

/**
 * Build a hollow, scaled shell that reproduces a block's texture.
 *
 * Each texture pixel becomes a `num × num` patch (expansion). With `den > 1`
 * the whole cube shrinks instead: the texture is split into
 * `ceil(textureSize / den)²` mirror-symmetric cells per face and each cell's
 * opaque pixels are averaged into one colour. Only the outer layer is filled.
 */
export function buildBlockReplica(
  textures: ReplicaTextures,
  palette: readonly PaletteEntry[],
  options: ReplicaOptions
): VoxelModel {
  const num = Math.max(1, Math.floor(options.scale.num));
  const den = Math.max(1, Math.floor(options.scale.den));
  const t = textures.south.width;
  const s = den > 1 ? Math.max(1, Math.ceil(t / den)) : t * num;

  const model = createVoxelModel(s, s, s);
  const cache = new Map<string, BlockState | null>();

  const match = (r: number, g: number, b: number): BlockState | null => {
    const key = `${r},${g},${b}`;
    if (cache.has(key)) return cache.get(key)!;
    const block = matchColor([r, g, b], palette);
    const state = block ? toBlockState(block) : null;
    cache.set(key, state);
    return state;
  };

  const pixel = (src: ImageSource, sx: number, sy: number): Rgb | null => {
    const o = (Math.min(sy, src.height - 1) * src.width + Math.min(sx, src.width - 1)) * 4;
    if (src.data[o + 3] < 32) return null;
    return [src.data[o], src.data[o + 1], src.data[o + 2]];
  };

  // Shrinking partitions each axis symmetrically (leftovers split across both
  // ends, not piled on the last cell) and averages the cell — both keep a
  // left-right symmetric texture symmetric after scaling.
  const cell = den > 1 ? symmetricPartition(t, s) : null;

  const resolveFace = (face: FaceDir, u: number, v: number): BlockState | null => {
    const src = textures[face];
    if (!cell) {
      const c = pixel(src, Math.floor(u / num), Math.floor(v / num));
      return c ? match(c[0], c[1], c[2]) : null;
    }
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let py = cell[v]; py < cell[v + 1]; py++) {
      for (let px = cell[u]; px < cell[u + 1]; px++) {
        const c = pixel(src, px, py);
        if (!c) continue;
        r += c[0];
        g += c[1];
        b += c[2];
        n += 1;
      }
    }
    if (n === 0) return null;
    return match(Math.round(r / n), Math.round(g / n), Math.round(b / n));
  };

  const position = (face: FaceDir, u: number, v: number): [number, number, number] => {
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
    for (let v = 0; v < s; v++) {
      for (let u = 0; u < s; u++) {
        const state = resolveFace(face, u, v);
        if (!state) continue;
        const [x, y, z] = position(face, u, v);
        setVoxel(model, x, y, z, state);
      }
    }
  }

  return model;
}
