import type { BlockInfo, Rgb } from "../blocks/types";
import type { SampledColor } from "../imaging/sample";
import { deltaE, srgbToLab, type Lab } from "./lab";

export interface PaletteEntry {
  block: BlockInfo;
  lab: Lab;
}

/** Precompute L*a*b* for the allowed blocks — do this once, reuse per pixel. */
export function buildPalette(blocks: readonly BlockInfo[]): PaletteEntry[] {
  return blocks.map((block) => ({ block, lab: srgbToLab(block.rgb) }));
}

/**
 * Nearest block to `rgb` within `palette`, by CIE76 ΔE.
 * Returns `null` only when the palette is empty.
 */
export function matchColor(rgb: Rgb, palette: readonly PaletteEntry[]): BlockInfo | null {
  if (palette.length === 0) return null;

  const target = srgbToLab(rgb);
  let best = palette[0];
  let bestDistance = deltaE(target, best.lab);

  for (let i = 1; i < palette.length; i++) {
    const distance = deltaE(target, palette[i].lab);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = palette[i];
    }
  }

  return best.block;
}

/**
 * Match a whole grid of sampled colours to blocks, caching repeated colours.
 * `null` samples (transparent / air) stay `null`.
 */
export function matchGrid(
  colors: readonly SampledColor[],
  palette: readonly PaletteEntry[]
): (BlockInfo | null)[] {
  const cache = new Map<string, BlockInfo | null>();
  return colors.map((color) => {
    if (!color) return null;
    const key = `${color[0]},${color[1]},${color[2]}`;
    if (cache.has(key)) return cache.get(key)!;
    const block = matchColor(color, palette);
    cache.set(key, block);
    return block;
  });
}
