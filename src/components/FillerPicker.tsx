import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { BLOCKS_BY_ID, SOLID_BLOCKS, SOLID_CATEGORIES } from "@/lib/blocks";
import type { BlockInfo } from "@/lib/blocks/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/** Filler blocks offered as one-click shortcuts above the full list. */
const COMMON_FILLER_IDS = ["stone", "cobblestone"];

function rgbCss([r, g, b]: [number, number, number]): string {
  return `rgb(${r} ${g} ${b})`;
}

function FillerButton({
  block,
  selected,
  onSelect,
}: {
  block: BlockInfo;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(block.id)}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent",
        selected && "bg-accent ring-1 ring-primary"
      )}
    >
      <span
        className="size-4 shrink-0 rounded-sm ring-1 ring-black/20 dark:ring-white/20"
        style={{ backgroundColor: rgbCss(block.rgb) }}
      />
      <span className="truncate text-xs">{block.name}</span>
    </button>
  );
}

/** Single-select, searchable filler block picker for mob captures. */
export function FillerPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const common = useMemo(
    () =>
      COMMON_FILLER_IDS.map((id) => BLOCKS_BY_ID.get(id)).filter(
        (b): b is BlockInfo => b !== undefined
      ),
    []
  );

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SOLID_CATEGORIES.map((category) => ({
      category,
      blocks: SOLID_BLOCKS.filter(
        (b) =>
          b.category === category &&
          (!q || b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q))
      ),
    })).filter((g) => g.blocks.length > 0);
  }, [query]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {common.map((b) => (
          <FillerButton key={b.id} block={b} selected={value === b.id} onSelect={onChange} />
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索填充方块"
          className="pl-8"
          aria-label="搜索填充方块"
        />
      </div>

      <div className="max-h-48 overflow-y-auto rounded-md border border-border p-1">
        {grouped.map(({ category, blocks }) => (
          <div key={category} className="pb-1">
            <p className="px-1 py-1 text-xs font-medium text-muted-foreground">{category}</p>
            <div className="grid grid-cols-2 gap-1">
              {blocks.map((b) => (
                <FillerButton
                  key={b.id}
                  block={b}
                  selected={value === b.id}
                  onSelect={onChange}
                />
              ))}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">没有匹配的方块</p>
        )}
      </div>
    </div>
  );
}
