import { matchColor, type PaletteEntry } from "../color/match";
import { toBlockState } from "./from-image";
import { isOccupied, surfaceColor, type McvoxCapture } from "./mcvox";
import { AIR, createVoxelModel, setVoxel, type BlockState, type VoxelModel } from "./model";

export type CaptureInterior = "hollow" | "fill";

/**
 * Hard cap on the expanded grid so an accidentally huge capture (or a large
 * magnification) cannot exhaust memory. `Uint32Array` of this many entries is
 * roughly 48 MB.
 */
export const MAX_CAPTURE_VOXELS = 12_000_000;

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

/**
 * Turn a native-resolution `.mcvox` capture into a voxel model:
 *
 * 1. Match each distinct surface colour to a palette block once.
 * 2. Expand every native voxel into an `N × N × N` region for the chosen
 *    magnification.
 * 3. Hidden interior voxels become a filler block (`fill`) or stay air
 *    (`hollow`).
 */
export function buildCaptureModel(
  capture: McvoxCapture,
  palette: readonly PaletteEntry[],
  options: CaptureOptions
): VoxelModel {
  const n = Math.max(1, Math.floor(options.magnification));
  const { sizeX, sizeY, sizeZ } = captureBounds(capture, n);
  const volume = sizeX * sizeY * sizeZ;
  if (volume > MAX_CAPTURE_VOXELS) {
    throw new RangeError(`捕获体素过多（${volume}），请降低放大倍率`);
  }

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
