import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { BLOCKS, CATEGORIES } from "@/lib/blocks";
import { useStudio } from "@/state/store";
import { useDebouncedValue } from "@/state/useDebouncedValue";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TEXTURE_PIXELS = 16;

export function PickBlockTab() {
  const selectedBlockId = useStudio((s) => s.selectedBlockId);
  const selectBlock = useStudio((s) => s.selectBlock);
  const magnification = useStudio((s) => s.magnification);
  const setMagnification = useStudio((s) => s.setMagnification);
  const [query, setQuery] = useState("");

  // Commit the magnification only once dragging stops so the 3D/model rebuild
  // never runs mid-drag.
  const [magDraft, setMagDraft] = useState(magnification);
  const debouncedMag = useDebouncedValue(magDraft, 200);
  useEffect(() => {
    if (debouncedMag !== magnification) setMagnification(debouncedMag);
  }, [debouncedMag, magnification, setMagnification]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORIES.map((category) => ({
      category,
      blocks: BLOCKS.filter(
        (b) => b.category === category && (!q || b.name.toLowerCase().includes(q))
      ),
    })).filter((g) => g.blocks.length > 0);
  }, [query]);

  const face = TEXTURE_PIXELS * magDraft;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 p-4 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索目标方块"
            className="pl-8"
            aria-label="搜索目标方块"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        {grouped.map(({ category, blocks }) => (
          <div key={category} className="pb-2">
            <p className="px-1 py-1 text-xs font-medium text-muted-foreground">{category}</p>
            <div className="grid grid-cols-2 gap-1">
              {blocks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => selectBlock(b.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent",
                    selectedBlockId === b.id && "bg-accent ring-1 ring-primary"
                  )}
                >
                  <span
                    className="size-4 shrink-0 rounded-sm ring-1 ring-black/20 dark:ring-white/20"
                    style={{ backgroundColor: `rgb(${b.rgb[0]} ${b.rgb[1]} ${b.rgb[2]})` }}
                  />
                  <span className="truncate text-xs">{b.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">没有匹配的方块</p>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="magnification">
            放大倍率：<span className="font-normal text-muted-foreground">{magDraft}×</span>
          </Label>
          <input
            id="magnification"
            type="range"
            min={1}
            max={12}
            step={1}
            value={magDraft}
            onChange={(e) => setMagDraft(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
        </div>

        <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <p>
            单面尺寸：<span className="font-medium text-foreground">{face}×{face}</span>
          </p>
          <p>
            总体尺寸：<span className="font-medium text-foreground">{face}×{face}×{face}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
