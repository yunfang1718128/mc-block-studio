import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, ExternalLink, FileUp, Search } from "lucide-react";
import { BLOCKS, CATEGORIES } from "@/lib/blocks";
import { captureSubject, parseMcvox } from "@/lib/voxel/mcvox";
import { useStudio, type BlockSource } from "@/state/store";
import { useGeneration } from "@/state/useGeneration";
import { useDebouncedValue } from "@/state/useDebouncedValue";
import { CaptureOptionsPanel } from "@/components/CaptureOptionsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const TEXTURE_PIXELS = 16;
/** Uploaded captures are voxel grids, so they afford a wider zoom than a 16px face. */
const UPLOAD_MAG_MIN = 1;
const UPLOAD_MAG_MAX = 12;

const SOURCES: { key: BlockSource; label: string }[] = [
  { key: "builtin", label: "内置方块" },
  { key: "upload", label: "上传文件" },
];

export function PickBlockTab() {
  const selectedBlockId = useStudio((s) => s.selectedBlockId);
  const selectBlock = useStudio((s) => s.selectBlock);
  const magnification = useStudio((s) => s.magnification);
  const setMagnification = useStudio((s) => s.setMagnification);
  const source = useStudio((s) => s.blockSource);
  const setSource = useStudio((s) => s.setBlockSource);
  const setViewMode = useStudio((s) => s.setViewMode);
  const blockCapture = useStudio((s) => s.blockCapture);
  const blockCaptureName = useStudio((s) => s.blockCaptureName);
  const setBlockCapture = useStudio((s) => s.setBlockCapture);
  const blockMagnification = useStudio((s) => s.blockMagnification);
  const setBlockMagnification = useStudio((s) => s.setBlockMagnification);
  const blockInterior = useStudio((s) => s.blockInterior);
  const setBlockInterior = useStudio((s) => s.setBlockInterior);
  const blockCull = useStudio((s) => s.blockCull);
  const setBlockCull = useStudio((s) => s.setBlockCull);
  const blockFiller = useStudio((s) => s.blockFiller);
  const setBlockFiller = useStudio((s) => s.setBlockFiller);
  const { model, captureInfo, error } = useGeneration();

  const [query, setQuery] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  function onSourceChange(next: BlockSource) {
    setSource(next);
    setParseError(null);
    // Uploaded blocks are voxel grids: the cube net is meaningless for them.
    if (next === "upload") setViewMode("3d");
  }

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setParseError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setBlockCapture(parseMcvox(bytes), file.name);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "无法读取 .mcvox");
    }
  }

  const header = blockCapture?.header;
  const isBlockCapture = header ? captureSubject(header) === "block" : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="m-4 mb-0 grid shrink-0 grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {SOURCES.map((s) => (
          <Button
            key={s.key}
            variant={source === s.key ? "default" : "ghost"}
            size="sm"
            onClick={() => onSourceChange(s.key)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {source === "builtin" ? (
        <>
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
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <input
            ref={inputRef}
            type="file"
            accept=".mcvox,application/octet-stream"
            className="hidden"
            onChange={(e) => void onFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFiles(e.dataTransfer.files);
            }}
            className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center transition-colors hover:bg-accent"
          >
            <FileUp className="size-6 text-muted-foreground" />
            <span className="text-sm font-medium">点击选择方块捕获包，或拖拽到此处</span>
            <span className="text-xs text-muted-foreground">由 block-capture 模组在游戏内导出</span>
          </button>
          <a
            href="https://github.com/yunfang1718128/block-capture"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            <ExternalLink className="size-3.5" />
            block-capture 模组 · GitHub
          </a>

          {parseError && <p className="text-xs text-destructive">{parseError}</p>}

          {header && blockCapture && (
            <>
              <div className="flex flex-col gap-1 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <p className="flex items-center gap-1 text-sm font-medium text-foreground">
                  <Boxes className="size-4" />
                  {header.entityName || header.entityId}
                </p>
                <p className="break-all">{header.entityId}</p>
                {header.blockState && <p className="break-all">{header.blockState}</p>}
                <p>
                  {blockCaptureName || "已载入"} · {blockCapture.sizeX}×{blockCapture.sizeY}×
                  {blockCapture.sizeZ} 模型像素 · {header.mcVersion}
                </p>
              </div>

              {!isBlockCapture && (
                <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-500">
                  这不是方块捕获包（可能来自 entity-capture 的生物捕获），仍可继续使用。
                </p>
              )}

              <CaptureOptionsPanel
                idPrefix="block"
                magnificationMin={UPLOAD_MAG_MIN}
                magnificationMax={UPLOAD_MAG_MAX}
                magnification={blockMagnification}
                onMagnification={setBlockMagnification}
                interior={blockInterior}
                onInterior={setBlockInterior}
                cull={blockCull}
                onCull={setBlockCull}
                filler={blockFiller}
                onFiller={setBlockFiller}
                model={model}
                captureInfo={captureInfo}
                error={error}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
