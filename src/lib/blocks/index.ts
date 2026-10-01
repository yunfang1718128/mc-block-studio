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

const BASE = import.meta.env?.BASE_URL ?? "/";

/** Resolve a block texture basename to a served URL. */
export function textureUrl(name: string): string {
  return `${BASE}blocks/${name}.png`;
}
