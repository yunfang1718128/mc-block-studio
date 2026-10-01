import { gzip } from "pako";
import {
  compound,
  emptyList,
  int,
  list,
  long,
  longArray,
  string,
  writeNbt,
  type CompoundTag,
  type NbtTag,
} from "../nbt";
import { nonAirCount, type BlockState, type VoxelModel } from "../voxel/model";

/** Litematica's own file format version, written as `Version`. */
export const LITEMATICA_VERSION = 6;

/** Minecraft data version stamped into the file. 4903 ships with 1.21-era worlds. */
export const DEFAULT_DATA_VERSION = 4903;

export interface EncodeOptions {
  name?: string;
  author?: string;
  description?: string;
  dataVersion?: number;
  regionName?: string;
  timeCreated?: number;
  timeModified?: number;
}

/**
 * Number of bits each block state index occupies in the packed array.
 * `ceil(log2(paletteSize))`, clamped to at least 1.
 */
export function bitsForPalette(paletteSize: number): number {
  if (paletteSize <= 1) return 1;
  return 32 - Math.clz32(paletteSize - 1);
}

/**
 * Packs block state indices using Litematica's *spanning* bit array: values are
 * written little-endian within a 64-bit word and continue into the next word
 * when they straddle a boundary. This matches `LitematicaBitArray`, not the
 * non-spanning array vanilla uses for chunk sections.
 */
export function packBlockStates(indices: ArrayLike<number>, bits: number): bigint[] {
  if (bits < 1 || bits > 32) {
    throw new RangeError(`Block state bit width out of range: ${bits}`);
  }
  const count = indices.length;
  const longCount = Math.ceil((count * bits) / 64);
  const longs = new Array<bigint>(longCount).fill(0n);
  const mask = (1n << BigInt(bits)) - 1n;

  for (let i = 0; i < count; i++) {
    const value = BigInt(indices[i]) & mask;
    const startOffset = i * bits;
    const startLong = Math.floor(startOffset / 64);
    const endLong = Math.floor((startOffset + bits - 1) / 64);
    const startBit = startOffset % 64;

    if (startLong === endLong) {
      longs[startLong] = BigInt.asUintN(64, longs[startLong] | (value << BigInt(startBit)));
    } else {
      const bitsRemaining = 64 - startBit;
      longs[startLong] = BigInt.asUintN(64, longs[startLong] | (value << BigInt(startBit)));
      longs[endLong] = BigInt.asUintN(64, longs[endLong] | (value >> BigInt(bitsRemaining)));
    }
  }

  return longs;
}

function blockStateToTag(state: BlockState): CompoundTag {
  const fields: Record<string, NbtTag> = { Name: string(state.name) };
  if (state.properties && Object.keys(state.properties).length > 0) {
    const properties: Record<string, NbtTag> = {};
    for (const [key, value] of Object.entries(state.properties)) {
      properties[key] = string(value);
    }
    fields.Properties = compound(properties);
  }
  return compound(fields);
}

function metadataTag(model: VoxelModel, options: EncodeOptions): CompoundTag {
  const now = Date.now();
  const created = options.timeCreated ?? now;
  const modified = options.timeModified ?? created;
  return compound({
    Name: string(options.name ?? "mc-block-studio"),
    Author: string(options.author ?? "mc-block-studio"),
    Description: string(options.description ?? ""),
    RegionCount: int(1),
    TotalBlocks: int(nonAirCount(model)),
    TotalVolume: int(model.sizeX * model.sizeY * model.sizeZ),
    TimeCreated: long(created),
    TimeModified: long(modified),
    EnclosingSize: compound({
      x: int(model.sizeX),
      y: int(model.sizeY),
      z: int(model.sizeZ),
    }),
  });
}

function regionTag(model: VoxelModel): CompoundTag {
  const bits = bitsForPalette(model.palette.length);
  const packed = packBlockStates(model.indices, bits);
  return compound({
    Position: compound({ x: int(0), y: int(0), z: int(0) }),
    Size: compound({ x: int(model.sizeX), y: int(model.sizeY), z: int(model.sizeZ) }),
    BlockStatePalette: list("compound", model.palette.map(blockStateToTag)),
    BlockStates: longArray(packed),
    TileEntities: emptyList(),
    Entities: emptyList(),
    PendingBlockTicks: emptyList(),
    PendingFluidTicks: emptyList(),
  });
}

/** Builds the uncompressed Litematica NBT tree for a voxel model. */
export function buildLitematicTree(model: VoxelModel, options: EncodeOptions = {}): CompoundTag {
  const regionName = options.regionName ?? "mc-block-studio";
  return compound({
    MinecraftDataVersion: int(options.dataVersion ?? DEFAULT_DATA_VERSION),
    Version: int(LITEMATICA_VERSION),
    Metadata: metadataTag(model, options),
    Regions: compound({ [regionName]: regionTag(model) }),
  });
}

/** Encodes a voxel model to an uncompressed NBT byte stream. */
export function encodeLitematicRaw(model: VoxelModel, options: EncodeOptions = {}): Uint8Array {
  return writeNbt(buildLitematicTree(model, options));
}

/** Encodes a voxel model to a gzipped `.litematic` byte stream. */
export function encodeLitematic(model: VoxelModel, options: EncodeOptions = {}): Uint8Array {
  return gzip(encodeLitematicRaw(model, options));
}
