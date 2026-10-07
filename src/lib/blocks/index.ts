export * from "./types";
export { BLOCKS, CATEGORIES } from "./blocks.generated";

import { BLOCKS } from "./blocks.generated";
import type { BlockInfo } from "./types";

/** Building blocks that participate in colour matching. */
export const SOLID_BLOCKS: BlockInfo[] = BLOCKS.filter((b) => b.kind === "solid");

/** Categories that contain at least one solid block, in catalogue order. */
export const SOLID_CATEGORIES: string[] = [...new Set(SOLID_BLOCKS.map((b) => b.category))];

/** Catalogue lookup by block id (without the `minecraft:` namespace). */
export const BLOCKS_BY_ID: Map<string, BlockInfo> = new Map(BLOCKS.map((b) => [b.id, b]));

/** Resolve a voxel's `minecraft:<id>` state name back to its catalogue entry. */
export function blockForState(name: string): BlockInfo | undefined {
  const id = name.startsWith("minecraft:") ? name.slice("minecraft:".length) : name;
  return BLOCKS_BY_ID.get(id);
}

/**
 * Solid blocks whose six faces are not identical. The generation pipeline
 * matches by colour and never rotates a block, so their distinctive top/front
 * faces can end up pointing the wrong way in a build.
 */
export const ORIENTATION_SENSITIVE_IDS: ReadonlySet<string> = new Set([
  "oak_log",
  "spruce_log",
  "birch_log",
  "jungle_log",
  "acacia_log",
  "dark_oak_log",
  "cherry_log",
  "mangrove_log",
  "pale_oak_log",
  "poplar_log",
  "bamboo_block",
  "crimson_nylium",
  "warped_nylium",
  "podzol",
  "grass_block",
  "mycelium",
]);

const BASE = import.meta.env?.BASE_URL ?? "/";

/** Resolve a block texture basename to a served URL. */
export function textureUrl(name: string): string {
  return `${BASE}blocks/${name}.png`;
}
