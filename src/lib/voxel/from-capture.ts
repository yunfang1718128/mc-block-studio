import { matchColor, type PaletteEntry } from "../color/match";
import { toBlockState } from "./from-image";
import {
  captureIndex,
  downsampleCapture,
  isOccupied,
  surfaceColor,
  type McvoxCapture,
} from "./mcvox";
import {
  AIR,
  createVoxelModel,
  paletteIndexOf,
  setVoxel,
  type BlockState,
  type VoxelModel,
} from "./model";

export type CaptureInterior = "hollow" | "fill";

/**
 * Hard cap on the expanded grid so an accidentally huge capture (or a large
 * magnification) cannot exhaust memory. `Uint32Array` of this many entries is
 * roughly 128 MB.
 *
 * The grid spans the whole bounding box, which for entity captures is mostly
 * air (e.g. a 400×136×234 dragon holds only ~85k real voxels). Captures whose
 * bounding box exceeds this are automatically downsampled instead of rejected,
 * so a preview is always possible.
 */
export const MAX_CAPTURE_VOXELS = 32_000_000;

export interface CaptureOptions {
  /** How many blocks each native voxel becomes (N³ expansion). */
  magnification: number;
  /** `hollow` keeps only the textured shell; `fill` also fills hidden interior. */
  interior: CaptureInterior;
  /**
   * Drop surface-coloured voxels that have no face exposed to the outside.
   * Captures paint internal faces too, so without this a mob keeps every
   * invisible block of its interior (default on).
   */
  cull?: boolean;
  /** Filler block used for interior voxels when `interior === "fill"`. */
  filler?: BlockState | null;
}

/** Final grid dimensions for a capture at a given magnification. */
export function captureBounds(
  capture: McvoxCapture,
  magnification: number
): { sizeX: number; sizeY: number; sizeZ: number } {
  const n = Math.max(1, Math.floor(magnification));
  return { sizeX: capture.sizeX * n, sizeY: capture.sizeY * n, sizeZ: capture.sizeZ * n };
}

/** How a capture will be laid out once expanded (before any downsampling). */
export interface CapturePlan {
  /** Applied magnification (integer, at least 1). */
  magnification: number;
  /** Integer downsampling factor applied to the native capture (1 = none). */
  downsample: number;
  /** Original capture dimensions. */
  nativeSize: [number, number, number];
  /** Native dimensions after downsampling. */
  effectiveSize: [number, number, number];
  /** Final model dimensions. */
  modelSize: [number, number, number];
  /** Final volume (`modelSize` product). */
  volume: number;
}

/**
 * Choose the smallest integer downsampling factor such that the expanded grid
 * fits within `limit`. Only throws when even a 1×1×1 capture cannot be reduced
 * any further (i.e. the magnification alone exceeds the budget).
 */
export function planCapture(
  capture: McvoxCapture,
  magnification: number,
  limit: number = MAX_CAPTURE_VOXELS
): CapturePlan {
  const n = Math.max(1, Math.floor(magnification));
  const nativeSize: [number, number, number] = [capture.sizeX, capture.sizeY, capture.sizeZ];

  for (let d = 1; ; d++) {
    const ex = Math.ceil(capture.sizeX / d);
    const ey = Math.ceil(capture.sizeY / d);
    const ez = Math.ceil(capture.sizeZ / d);
    const volume = ex * ey * ez * n * n * n;
    if (volume <= limit) {
      return {
        magnification: n,
        downsample: d,
        nativeSize,
        effectiveSize: [ex, ey, ez],
        modelSize: [ex * n, ey * n, ez * n],
        volume,
      };
    }
    // Once the capture is down to a single voxel, no factor can shrink it more.
    if (ex === 1 && ey === 1 && ez === 1) {
      throw new RangeError(`捕获体素过多（${volume}），请降低放大倍率`);
    }
  }
}

/** A built capture model plus the layout decisions made to keep it affordable. */
export interface CaptureBuild {
  model: VoxelModel;
  /** Integer downsampling factor applied to the native capture (1 = none). */
  downsample: number;
  nativeSize: [number, number, number];
  effectiveSize: [number, number, number];
}

/**
 * Turn a native-resolution `.mcvox` capture into a voxel model:
 *
 * 1. Match each distinct surface colour to a palette block once.
 * 2. Expand every native voxel into an `N × N × N` region for the chosen
 *    magnification.
 * 3. Hidden interior voxels become a filler block (`fill`) or stay air
 *    (`hollow`).
 *
 * Oversized captures are downsampled rather than rejected so they can always be
 * previewed; `downsample` reports the applied factor.
 */
export function buildCapture(
  capture: McvoxCapture,
  palette: readonly PaletteEntry[],
  options: CaptureOptions
): CaptureBuild {
  const plan = planCapture(capture, options.magnification);
  const source = plan.downsample > 1 ? downsampleCapture(capture, plan.downsample) : capture;
  return {
    model: expandCapture(source, palette, plan.magnification, options),
    downsample: plan.downsample,
    nativeSize: plan.nativeSize,
    effectiveSize: plan.effectiveSize,
  };
}

/** Backwards-compatible wrapper returning just the model. */
export function buildCaptureModel(
  capture: McvoxCapture,
  palette: readonly PaletteEntry[],
  options: CaptureOptions
): VoxelModel {
  return buildCapture(capture, palette, options).model;
}

function expandCapture(
  capture: McvoxCapture,
  palette: readonly PaletteEntry[],
  n: number,
  options: CaptureOptions
): VoxelModel {
  const { sizeX, sizeY, sizeZ } = captureBounds(capture, n);
  const model = createVoxelModel(sizeX, sizeY, sizeZ);
  const filler = options.interior === "fill" ? (options.filler ?? null) : null;
  const cull = options.cull ?? true;
  // The outside map is only needed to test visibility (cull) or to spot sealed
  // cavities (fill); with both off the naive shell is emitted unchanged.
  const outside = cull || filler ? computeOutside(capture) : new Uint8Array(0);
  const cache = new Map<number, BlockState | null>();

  const blockForColor = (color: [number, number, number]): BlockState | null => {
    const key = (color[0] << 16) | (color[1] << 8) | color[2];
    if (!cache.has(key)) {
      const block = matchColor(color, palette);
      cache.set(key, block ? toBlockState(block) : null);
    }
    return cache.get(key)!;
  };

  for (let y = 0; y < capture.sizeY; y++) {
    for (let z = 0; z < capture.sizeZ; z++) {
      for (let x = 0; x < capture.sizeX; x++) {
        let state: BlockState | null = null;

        if (isOccupied(capture, x, y, z)) {
          const color = surfaceColor(capture, x, y, z);
          if (color && (!cull || hasExposedFace(capture, outside, x, y, z))) {
            state = blockForColor(color);
          } else if (filler) {
            // Hidden surface paint (culled) or an unpainted interior voxel:
            // `fill` replaces it with the filler block.
            state = filler;
          }
        } else if (filler && outside[captureIndex(capture, x, y, z)] === 0) {
          // Empty but sealed off from the outside: part of the solid interior.
          state = filler;
        }

        if (!state) continue;

        const bx = x * n;
        const by = y * n;
        const bz = z * n;
        for (let dz = 0; dz < n; dz++) {
          for (let dy = 0; dy < n; dy++) {
            for (let dx = 0; dx < n; dx++) {
              setVoxel(model, bx + dx, by + dy, bz + dz, state);
            }
          }
        }
      }
    }
  }

  // Guarantee the air entry exists for the encoder.
  paletteIndexOf(model, AIR);
  return model;
}

/**
 * Mark every empty voxel reachable from outside the grid (6-connectivity) in a
 * byte per voxel. A voxel left at 0 is either occupied or sealed inside the
 * model's shell, which is exactly what separates visible surface from hidden
 * interior.
 */
function computeOutside(capture: McvoxCapture): Uint8Array {
  const { sizeX, sizeY, sizeZ } = capture;
  const outside = new Uint8Array(sizeX * sizeY * sizeZ);
  const stack: number[] = [];

  const seed = (x: number, y: number, z: number) => {
    const i = captureIndex(capture, x, y, z);
    if (outside[i] === 0 && !isOccupied(capture, x, y, z)) {
      outside[i] = 1;
      stack.push(i);
    }
  };

  for (let y = 0; y < sizeY; y++) {
    for (let x = 0; x < sizeX; x++) {
      seed(x, y, 0);
      seed(x, y, sizeZ - 1);
    }
  }
  for (let z = 0; z < sizeZ; z++) {
    for (let x = 0; x < sizeX; x++) {
      seed(x, 0, z);
      seed(x, sizeY - 1, z);
    }
  }
  for (let z = 0; z < sizeZ; z++) {
    for (let y = 0; y < sizeY; y++) {
      seed(0, y, z);
      seed(sizeX - 1, y, z);
    }
  }

  const visit = (x: number, y: number, z: number) => {
    if (x < 0 || y < 0 || z < 0 || x >= sizeX || y >= sizeY || z >= sizeZ) return;
    const i = captureIndex(capture, x, y, z);
    if (outside[i] === 0 && !isOccupied(capture, x, y, z)) {
      outside[i] = 1;
      stack.push(i);
    }
  };

  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % sizeX;
    const yz = (i / sizeX) | 0;
    const z = yz % sizeZ;
    const y = (yz / sizeZ) | 0;
    visit(x + 1, y, z);
    visit(x - 1, y, z);
    visit(x, y + 1, z);
    visit(x, y - 1, z);
    visit(x, y, z + 1);
    visit(x, y, z - 1);
  }

  return outside;
}

/** True when an occupied voxel has at least one face open to the outside. */
function hasExposedFace(
  capture: McvoxCapture,
  outside: Uint8Array,
  x: number,
  y: number,
  z: number
): boolean {
  const open = (px: number, py: number, pz: number): boolean => {
    if (px < 0 || py < 0 || pz < 0 || px >= capture.sizeX || py >= capture.sizeY || pz >= capture.sizeZ) {
      return true;
    }
    return outside[captureIndex(capture, px, py, pz)] === 1;
  };
  return (
    open(x + 1, y, z) ||
    open(x - 1, y, z) ||
    open(x, y + 1, z) ||
    open(x, y - 1, z) ||
    open(x, y, z + 1) ||
    open(x, y, z - 1)
  );
}
