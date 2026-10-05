/**
 * `.mcvox` — the intermediate capture format produced by the `capture` Fabric
 * mod and consumed here. A capture is a native-resolution (1 voxel = 1 model
 * pixel) grid of an entity: a bit-packed occupancy bitmap plus an RGBA colour
 * layer for the surface voxels. All scaling, hollowing and block matching
 * happen in the studio, never in the mod.
 *
 * Layout (little-endian):
 *   [0..3]   magic "MCVX"
 *   [4]      uint8  formatVersion
 *   [5]      uint8  flags        (bit0 = payload is zlib/deflate compressed)
 *   [6..7]   uint16 reserved
 *   [8..11]  uint32 headerLength
 *   [12..]   header JSON (UTF-8)
 *   then     occupancy: ceil(n / 8) bytes   (n = sizeX*sizeY*sizeZ)
 *   then     colors:    n * 4 bytes RGBA
 *
 * Voxel index is x + z*sizeX + y*sizeX*sizeZ, matching `VoxelModel`.
 */
import { deflate, inflate } from "pako";
import type { Rgb } from "../blocks/types";

export const MCVOX_MAGIC = "MCVX";
export const MCVOX_FORMAT_VERSION = 1;

const MAGIC_BYTES = [0x4d, 0x43, 0x56, 0x58];
const HEADER_BYTES = 12;
const FLAG_COMPRESSED = 1;

export interface McvoxHeader {
  formatVersion: number;
  entityId: string;
  entityName: string;
  mcVersion: string;
  modLoader: string;
  /** Model pixels per Minecraft block; vanilla models use 16. */
  unitsPerBlock: number;
  dimensions: [x: number, y: number, z: number];
  solid: boolean;
  animatedTick?: number;
  generatedAt?: string;
}

export interface McvoxCapture {
  header: McvoxHeader;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  /** Bit-packed occupancy, LSB-first, length `ceil(sizeX*sizeY*sizeZ / 8)`. */
  occupancy: Uint8Array;
  /** RGBA, length `sizeX*sizeY*sizeZ*4`. Surface voxels carry colour; others zero. */
  colors: Uint8Array;
}

export interface EncodeMcvoxOptions {
  compress?: boolean;
}

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function writeUint32LE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

/** Flat index of a voxel, matching `VoxelModel`'s x-fastest ordering. */
export function captureIndex(capture: McvoxCapture, x: number, y: number, z: number): number {
  return x + z * capture.sizeX + y * capture.sizeX * capture.sizeZ;
}

export function isOccupied(capture: McvoxCapture, x: number, y: number, z: number): boolean {
  const i = captureIndex(capture, x, y, z);
  return (capture.occupancy[i >> 3] & (1 << (i & 7))) !== 0;
}

/**
 * Surface colour at a voxel, or `null` when the voxel has no colour
 * (air or hidden interior). Alpha of 0 marks "no colour".
 */
export function surfaceColor(capture: McvoxCapture, x: number, y: number, z: number): Rgb | null {
  const i = captureIndex(capture, x, y, z) * 4;
  if (capture.colors[i + 3] === 0) return null;
  return [capture.colors[i], capture.colors[i + 1], capture.colors[i + 2]];
}

/**
 * Reduce a capture's resolution by an integer factor: each output voxel covers
 * a `factor × factor × factor` block of source voxels. A block is occupied when
 * any source voxel in it is occupied, and its colour is the first
 * non-transparent source colour found. The header dimensions are updated.
 */
export function downsampleCapture(capture: McvoxCapture, factor: number): McvoxCapture {
  const d = Math.max(1, Math.floor(factor));
  if (d <= 1) return capture;

  const sizeX = Math.ceil(capture.sizeX / d);
  const sizeY = Math.ceil(capture.sizeY / d);
  const sizeZ = Math.ceil(capture.sizeZ / d);
  const count = sizeX * sizeY * sizeZ;
  const occupancy = new Uint8Array(Math.ceil(count / 8));
  const colors = new Uint8Array(count * 4);

  for (let oy = 0; oy < sizeY; oy++) {
    for (let oz = 0; oz < sizeZ; oz++) {
      for (let ox = 0; ox < sizeX; ox++) {
        let occupied = false;
        let color: [number, number, number] | null = null;
        const yEnd = Math.min((oy + 1) * d, capture.sizeY);
        const zEnd = Math.min((oz + 1) * d, capture.sizeZ);
        const xEnd = Math.min((ox + 1) * d, capture.sizeX);

        for (let y = oy * d; y < yEnd && (!occupied || !color); y++) {
          for (let z = oz * d; z < zEnd && (!occupied || !color); z++) {
            for (let x = ox * d; x < xEnd; x++) {
              const si = captureIndex(capture, x, y, z);
              if (!occupied && (capture.occupancy[si >> 3] & (1 << (si & 7))) !== 0) {
                occupied = true;
              }
              if (!color) {
                const ci = si * 4;
                if (capture.colors[ci + 3] !== 0) {
                  color = [capture.colors[ci], capture.colors[ci + 1], capture.colors[ci + 2]];
                }
              }
              if (occupied && color) break;
            }
          }
        }

        const oi = ox + oz * sizeX + oy * sizeX * sizeZ;
        if (occupied) occupancy[oi >> 3] |= 1 << (oi & 7);
        if (color) {
          const ci = oi * 4;
          colors[ci] = color[0];
          colors[ci + 1] = color[1];
          colors[ci + 2] = color[2];
          colors[ci + 3] = 255;
        }
      }
    }
  }

  return {
    header: { ...capture.header, dimensions: [sizeX, sizeY, sizeZ] },
    sizeX,
    sizeY,
    sizeZ,
    occupancy,
    colors,
  };
}

function validDimensions(header: McvoxHeader): [number, number, number] {
  const dims = header?.dimensions;
  if (!Array.isArray(dims) || dims.length !== 3) {
    throw new Error("不是有效的 .mcvox：缺少 dimensions");
  }
  for (const value of dims) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`不是有效的 .mcvox：非法 dimensions（${dims.join(",")}）`);
    }
  }
  return [dims[0], dims[1], dims[2]];
}

/** Parse a `.mcvox` payload, validating the header and layer lengths. */
export function parseMcvox(bytes: Uint8Array): McvoxCapture {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError(".mcvox 需要 Uint8Array");
  }
  if (bytes.length < HEADER_BYTES) {
    throw new Error("不是有效的 .mcvox：文件过短");
  }
  for (let i = 0; i < MAGIC_BYTES.length; i++) {
    if (bytes[i] !== MAGIC_BYTES[i]) {
      throw new Error("不是有效的 .mcvox：文件头不匹配");
    }
  }

  const version = bytes[4];
  if (version !== MCVOX_FORMAT_VERSION) {
    throw new Error(`不支持的 .mcvox 版本：${version}`);
  }
  const flags = bytes[5];
  const headerLength = readUint32LE(bytes, 8);
  const headerEnd = HEADER_BYTES + headerLength;
  if (headerEnd > bytes.length) {
    throw new Error("不是有效的 .mcvox：header 越界");
  }

  let header: McvoxHeader;
  try {
    header = JSON.parse(textDecoder.decode(bytes.subarray(HEADER_BYTES, headerEnd))) as McvoxHeader;
  } catch {
    throw new Error("不是有效的 .mcvox：header JSON 解析失败");
  }

  const [sizeX, sizeY, sizeZ] = validDimensions(header);
  const count = sizeX * sizeY * sizeZ;
  const occupancyLength = Math.ceil(count / 8);
  const expected = occupancyLength + count * 4;

  let payload = bytes.subarray(headerEnd);
  if (flags & FLAG_COMPRESSED) {
    try {
      payload = inflate(payload);
    } catch {
      throw new Error("不是有效的 .mcvox：负载解压失败");
    }
  }
  if (payload.length !== expected) {
    throw new Error(`不是有效的 .mcvox：负载长度不符（期望 ${expected}，实际 ${payload.length}）`);
  }

  return {
    header,
    sizeX,
    sizeY,
    sizeZ,
    occupancy: payload.subarray(0, occupancyLength),
    colors: payload.subarray(occupancyLength),
  };
}

/** Serialise a capture back to `.mcvox` bytes (used for tests and tooling). */
export function encodeMcvox(capture: McvoxCapture, options: EncodeMcvoxOptions = {}): Uint8Array {
  const header: McvoxHeader = {
    ...capture.header,
    formatVersion: MCVOX_FORMAT_VERSION,
    dimensions: [capture.sizeX, capture.sizeY, capture.sizeZ],
  };
  const headerJson = textEncoder.encode(JSON.stringify(header));

  let payload = new Uint8Array(capture.occupancy.length + capture.colors.length);
  payload.set(capture.occupancy, 0);
  payload.set(capture.colors, capture.occupancy.length);

  let flags = 0;
  if (options.compress) {
    payload = deflate(payload);
    flags |= FLAG_COMPRESSED;
  }

  const out = new Uint8Array(HEADER_BYTES + headerJson.length + payload.length);
  out.set(MAGIC_BYTES, 0);
  out[4] = MCVOX_FORMAT_VERSION;
  out[5] = flags;
  writeUint32LE(out, 8, headerJson.length);
  out.set(headerJson, HEADER_BYTES);
  out.set(payload, HEADER_BYTES + headerJson.length);
  return out;
}
