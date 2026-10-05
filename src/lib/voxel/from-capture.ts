import { matchColor, type PaletteEntry } from "../color/match";
import { toBlockState } from "./from-image";
import { downsampleCapture, isOccupied, surfaceColor, type McvoxCapture } from "./mcvox";
import { AIR, createVoxelModel, setVoxel, type BlockState, type VoxelModel } from "./model";

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
  const cache = new Map<number, BlockState | null>();

  for (let y = 0; y < capture.sizeY; y++) {
    for (let z = 0; z < capture.sizeZ; z++) {
      for (let x = 0; x < capture.sizeX; x++) {
        const color = surfaceColor(capture, x, y, z);
        let state: BlockState | null = null;

        if (color) {
          const key = (color[0] << 16) | (color[1] << 8) | color[2];
          if (cache.has(key)) {
            state = cache.get(key)!;
          } else {
            const block = matchColor(color, palette);
            state = block ? toBlockState(block) : null;
            cache.set(key, state);
          }
        } else if (filler && isOccupied(capture, x, y, z)) {
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
  if (!model.palette.includes(AIR)) model.palette.push(AIR);
  return model;
}
