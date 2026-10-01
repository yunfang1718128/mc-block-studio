import { useMemo } from "react";
import { blockForState } from "@/lib/blocks";
import { countBlocks, type VoxelModel } from "@/lib/voxel/model";

/** Per-block tally of the current model, in a scrollable list. */
export function MaterialsList({ model }: { model: VoxelModel }) {
  const materials = useMemo(() => {
    const entries = countBlocks(model);
    const total = entries.reduce((sum, e) => sum + e.count, 0);
    return {
      total,
      entries: entries.map((entry) => {
        const block = blockForState(entry.state.name);
        return {
          id: entry.state.name,
          name: block?.name ?? entry.state.name.replace("minecraft:", ""),
          rgb: block?.rgb ?? ([128, 128, 128] as const),
          count: entry.count,
        };
      }),
    };
  }, [model]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <span className="text-xs font-medium">材料清单</span>
        <span className="text-xs text-muted-foreground">
          {materials.entries.length} 种 · {materials.total} 方块
        </span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-1">
        {materials.entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-accent">
            <span
              className="size-3.5 shrink-0 rounded-sm ring-1 ring-black/20 dark:ring-white/20"
              style={{ backgroundColor: `rgb(${entry.rgb[0]} ${entry.rgb[1]} ${entry.rgb[2]})` }}
            />
            <span className="min-w-0 flex-1 truncate text-xs">{entry.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{entry.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
