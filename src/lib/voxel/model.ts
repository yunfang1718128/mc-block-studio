/**
 * A dense 3-D voxel grid, the single in-memory shape both generation modes feed
 * and the `.litematic` encoder consumes.
 *
 * Voxels are stored as indices into `palette` in a flat, row-major array whose
 * fastest axis is x, then z, then y — matching the order Litematica itself uses
 * for block state indices (`x + z*sizeX + y*sizeX*sizeZ`).
 */

export interface BlockState {
  name: string;
  properties?: Record<string, string>;
}

export const AIR: BlockState = { name: "minecraft:air" };

export interface VoxelModel {
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  palette: BlockState[];
  /** Length `sizeX * sizeY * sizeZ`; each entry indexes into `palette`. */
  indices: Uint32Array;
  /**
   * Internal `blockKey -> palette index` cache that keeps `paletteIndexOf`
   * O(1). Built lazily, so hand-assembled models work too; mutate `palette`
   * only through `paletteIndexOf` or rebuild this map.
   */
  keyCache?: Map<string, number>;
}

/** Stable key for palette de-duplication: `name[k=v,k2=v2]` with sorted keys. */
export function blockKey(state: BlockState): string {
  const props = state.properties;
  if (!props) return state.name;
  const keys = Object.keys(props).sort();
  if (keys.length === 0) return state.name;
  return `${state.name}[${keys.map((k) => `${k}=${props[k]}`).join(",")}]`;
}

export function voxelIndex(
  sizeX: number,
  sizeZ: number,
  x: number,
  y: number,
  z: number,
): number {
  return x + z * sizeX + y * sizeX * sizeZ;
}

export function inBounds(model: VoxelModel, x: number, y: number, z: number): boolean {
  return (
    x >= 0 &&
    y >= 0 &&
    z >= 0 &&
    x < model.sizeX &&
    y < model.sizeY &&
    z < model.sizeZ
  );
}

export function createVoxelModel(
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  palette: BlockState[] = [AIR],
): VoxelModel {
  if (sizeX <= 0 || sizeY <= 0 || sizeZ <= 0) {
    throw new RangeError("Voxel model dimensions must be positive");
  }
  return {
    sizeX,
    sizeY,
    sizeZ,
    palette: palette.slice(),
    indices: new Uint32Array(sizeX * sizeY * sizeZ),
  };
}

/** Build the `blockKey -> index` map, first entry wins on duplicates. */
function rebuildKeyCache(model: VoxelModel): Map<string, number> {
  const cache = new Map<string, number>();
  model.palette.forEach((entry, i) => {
    const key = blockKey(entry);
    if (!cache.has(key)) cache.set(key, i);
  });
  model.keyCache = cache;
  return cache;
}

export function paletteIndexOf(model: VoxelModel, state: BlockState): number {
  const cache = model.keyCache ?? rebuildKeyCache(model);
  const key = blockKey(state);
  let index = cache.get(key);
  if (index === undefined) {
    index = model.palette.length;
    model.palette.push(state);
    cache.set(key, index);
  }
  return index;
}

export function setVoxel(
  model: VoxelModel,
  x: number,
  y: number,
  z: number,
  state: BlockState,
): void {
  if (!inBounds(model, x, y, z)) {
    throw new RangeError(`Voxel (${x},${y},${z}) outside model bounds`);
  }
  model.indices[voxelIndex(model.sizeX, model.sizeZ, x, y, z)] = paletteIndexOf(model, state);
}

export function getVoxel(model: VoxelModel, x: number, y: number, z: number): BlockState {
  if (!inBounds(model, x, y, z)) {
    throw new RangeError(`Voxel (${x},${y},${z}) outside model bounds`);
  }
  return model.palette[model.indices[voxelIndex(model.sizeX, model.sizeZ, x, y, z)]];
}

export function isAir(state: BlockState): boolean {
  return state.name === "minecraft:air";
}

export interface BlockCount {
  state: BlockState;
  count: number;
}

/** Per-block tally of non-air voxels, sorted by descending count. */
export function countBlocks(model: VoxelModel): BlockCount[] {
  const counts = new Uint32Array(model.palette.length);
  for (let i = 0; i < model.indices.length; i++) counts[model.indices[i]]++;
  const out: BlockCount[] = [];
  for (let p = 0; p < model.palette.length; p++) {
    if (isAir(model.palette[p]) || counts[p] === 0) continue;
    out.push({ state: model.palette[p], count: counts[p] });
  }
  out.sort((a, b) => b.count - a.count || blockKey(a.state).localeCompare(blockKey(b.state)));
  return out;
}

export function totalVolume(model: VoxelModel): number {
  return model.sizeX * model.sizeY * model.sizeZ;
}

export function nonAirCount(model: VoxelModel): number {
  const air = model.palette.findIndex(isAir);
  let count = 0;
  for (let i = 0; i < model.indices.length; i++) {
    if (model.indices[i] !== air) count++;
  }
  return count;
}
