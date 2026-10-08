import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { SOLID_BLOCKS, SOLID_CATEGORIES } from "@/lib/blocks";
import type { BlockInfo } from "@/lib/blocks/types";
import { useStudio } from "@/state/store";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

function rgbCss([r, g, b]: [number, number, number]): string {
  return `rgb(${r} ${g} ${b})`;
}

function BlockRow({ block, checked }: { block: BlockInfo; checked: boolean }) {
  const toggleBlock = useStudio((s) => s.toggleBlock);
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
      <Checkbox checked={checked} onCheckedChange={() => toggleBlock(block.id)} />
      <span
        className="size-4 shrink-0 rounded-sm ring-1 ring-black/20 dark:ring-white/20"
        style={{ backgroundColor: rgbCss(block.rgb) }}
      />
      <span className="truncate text-sm">{block.name}</span>
    </label>
  );
}

function CategoryGroup({
  category,
  blocks,
  allowed,
  collapsed,
  onToggleCollapse,
}: {
  category: string;
  blocks: BlockInfo[];
  allowed: Set<string>;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const setCategory = useStudio((s) => s.setCategory);
  const enabledCount = blocks.filter((b) => allowed.has(b.id)).length;
  const allEnabled = enabledCount === blocks.length;
  const someEnabled = enabledCount > 0 && !allEnabled;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-1 py-1">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent"
          aria-label={collapsed ? `展开${category}` : `折叠${category}`}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        <Checkbox
          checked={allEnabled ? true : someEnabled ? "indeterminate" : false}
          onCheckedChange={(state) => setCategory(category, state === true)}
        />
        <button type="button" onClick={onToggleCollapse} className="flex-1 text-left text-sm font-medium">
          {category}
        </button>
        <span className="text-xs text-muted-foreground">
          {enabledCount}/{blocks.length}
        </span>
      </div>
      {!collapsed && (
        <div className="mb-1 flex flex-col gap-0.5 pl-4">
          {blocks.map((b) => (
            <BlockRow key={b.id} block={b} checked={allowed.has(b.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PaletteTray() {
  const allowed = useStudio((s) => s.allowed);
  const setAll = useStudio((s) => s.setAll);
  const mode = useStudio((s) => s.mode);
  const filterOrientationSensitive = useStudio((s) => s.filterOrientationSensitive);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SOLID_CATEGORIES.map((category) => ({
      category,
      blocks: SOLID_BLOCKS.filter(
        (b) => b.category === category && (!q || b.name.toLowerCase().includes(q))
      ),
    })).filter((g) => g.blocks.length > 0);
  }, [query]);

  const toggleCollapse = (category: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">可用方块</h2>
          <span className="text-xs text-muted-foreground">已选 {allowed.size}</span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索方块"
            className="pl-8"
            aria-label="搜索方块"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => setAll(true)}>
            全选
          </Button>
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => setAll(false)}>
            全不选
          </Button>
        </div>
        {(mode === "mob" || mode === "block") && (
          <>
            <Button
              variant="outline"
              size="sm"
              title="取消勾选六面贴图不一致的方块（原木、菌岩、草方块等），它们摆放时不会转向，容易露错面"
              onClick={filterOrientationSensitive}
            >
              筛选不适合方块
            </Button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {mode === "mob" ? "生物模型" : "方块复刻与生物模型"}
              摆放方块时不会自动转向，原木、草方块这类六面贴图不一致的方块容易露错面；点击可一次性取消勾选。
            </p>
          </>
        )}
      </div>
      <Separator />
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {grouped.map(({ category, blocks }) => (
          <CategoryGroup
            key={category}
            category={category}
            blocks={blocks}
            allowed={allowed}
            collapsed={collapsed.has(category)}
            onToggleCollapse={() => toggleCollapse(category)}
          />
        ))}
        {grouped.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">没有匹配的方块</p>
        )}
      </div>
    </aside>
  );
}
