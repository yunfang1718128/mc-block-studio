import type { BlockInfo, FaceDir } from "../blocks/types";
import { matchColor, type PaletteEntry } from "../color/match";
import type { ReplicaTextures } from "./from-block";

const FACES: readonly FaceDir[] = ["top", "bottom", "north", "south", "east", "west"];

export interface ReplicaFaceMap {
  /** Side length of each face grid, in texture pixels. */
  size: number;
  /** Matched block per pixel, row-major. `null` = transparent. */
  faces: Record<FaceDir, (BlockInfo | null)[]>;
}

/**
 * Flatten a block replica into six 2D grids of matched blocks — the data behind
 * the "cube net" preview. Each face is matched from its own texture, mirroring
 * {@link buildBlockReplica}.
 */
export function buildReplicaFaceMap(
  textures: ReplicaTextures,
  palette: readonly PaletteEntry[]
): ReplicaFaceMap {
  const size = textures.south.width;
  const cache = new Map<string, BlockInfo | null>();

  const faces = {} as Record<FaceDir, (BlockInfo | null)[]>;

  for (const face of FACES) {
    const src = textures[face];
    const cells: (BlockInfo | null)[] = new Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const sx = Math.min(x, src.width - 1);
        const sy = Math.min(y, src.height - 1);
        const o = (sy * src.width + sx) * 4;
        if (src.data[o + 3] < 32) {
          cells[y * size + x] = null;
          continue;
        }
        const key = `${src.data[o]},${src.data[o + 1]},${src.data[o + 2]}`;
        if (!cache.has(key)) {
          cache.set(key, matchColor([src.data[o], src.data[o + 1], src.data[o + 2]], palette));
        }
        cells[y * size + x] = cache.get(key)!;
      }
    }

    faces[face] = cells;
  }

  return { size, faces };
}
