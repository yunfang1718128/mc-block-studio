import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FileUp, PawPrint } from "lucide-react";
import { SOLID_BLOCKS } from "@/lib/blocks";
import { parseMcvox } from "@/lib/voxel/mcvox";
import { BUILTIN_MOBS, mobUrl, type BuiltinMob, type MobCategory } from "@/lib/voxel/builtin-mobs";
import { nonAirCount } from "@/lib/voxel/model";
import { cn } from "@/lib/utils";
import { useStudio } from "@/state/store";
import { useGeneration } from "@/state/useGeneration";
import { useDebouncedValue } from "@/state/useDebouncedValue";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAG_MIN = 1;
const MAG_MAX = 8;

type Source = "builtin" | "upload";

const CATEGORIES: { key: "all" | MobCategory; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "passive", label: "被动" },
  { key: "water", label: "水生" },
  { key: "hostile", label: "敌对" },
];

export function ImportMobTab() {
  const capture = useStudio((s) => s.capture);
  const captureName = useStudio((s) => s.captureName);
  const setCapture = useStudio((s) => s.setCapture);
  const magnification = useStudio((s) => s.captureMagnification);
  const setMagnification = useStudio((s) => s.setCaptureMagnification);
  const interior = useStudio((s) => s.captureInterior);
  const setInterior = useStudio((s) => s.setCaptureInterior);
  const cull = useStudio((s) => s.captureCull);
  const setCull = useStudio((s) => s.setCaptureCull);
  const filler = useStudio((s) => s.captureFiller);
  const setFiller = useStudio((s) => s.setCaptureFiller);
  const { model, error, captureInfo } = useGeneration();

  const [source, setSource] = useState<Source>("builtin");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | MobCategory>("all");
  const [parseError, setParseError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Commit the magnification once dragging stops so the model never rebuilds
  // mid-drag.
  const [magDraft, setMagDraft] = useState(magnification);
  useEffect(() => {
    setMagDraft(magnification);
  }, [magnification]);
  const debouncedMag = useDebouncedValue(magDraft, 200);
  useEffect(() => {
    if (debouncedMag !== magnification) setMagnification(debouncedMag);
  }, [debouncedMag, magnification, setMagnification]);

  const total = useMemo(() => (model ? nonAirCount(model) : 0), [model]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BUILTIN_MOBS.filter((mob) => {
      if (category !== "all" && mob.category !== category) return false;
      if (!q) return true;
      return mob.name.toLowerCase().includes(q) || mob.id.toLowerCase().includes(q);
    });
  }, [query, category]);

  async function loadBuiltin(mob: BuiltinMob) {
    setParseError(null);
    setLoadingId(mob.id);
    try {
      const response = await fetch(mobUrl(mob.file));
      if (!response.ok) throw new Error(`无法加载 ${mob.file}（HTTP ${response.status}）`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      setCapture(parseMcvox(bytes), mob.name);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "无法读取 .mcvox");
    } finally {
      setLoadingId(null);
    }
  }

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setParseError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setCapture(parseMcvox(bytes), file.name);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "无法读取 .mcvox");
    }
  }

  const loadedId = capture?.header.entityId ?? null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <Button
          variant={source === "builtin" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSource("builtin")}
        >
          内置生物
        </Button>
        <Button
          variant={source === "upload" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSource("upload")}
        >
          上传文件
        </Button>
      </div>

      {source === "builtin" ? (
        <>
          <Input
            placeholder="搜索名称 / ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((c) => (
              <Button
                key={c.key}
                variant={category === c.key ? "default" : "outline"}
                size="sm"
                onClick={() => setCategory(c.key)}
              >
                {c.label}
              </Button>
            ))}
          </div>

          <div className="max-h-64 overflow-y-auto rounded-md border border-border">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">没有匹配的生物</p>
            ) : (
              filtered.map((mob) => (
                <button
                  key={mob.id}
                  type="button"
                  disabled={loadingId !== null}
                  onClick={() => void loadBuiltin(mob)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent disabled:opacity-60",
                    loadedId === mob.id && "bg-accent"
                  )}
                >
                  <span className="truncate">{mob.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{mob.id}</span>
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <>
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
            <span className="text-sm font-medium">点击选择 .mcvox，或拖拽到此处</span>
            <span className="text-xs text-muted-foreground">由 capture 模组在游戏内导出</span>
          </button>
          <a
            href="https://github.com/yunfang1718128/entity-capture"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            <ExternalLink className="size-3.5" />
            capture 模组 · GitHub
          </a>
        </>
      )}

      {parseError && <p className="text-xs text-destructive">{parseError}</p>}

      {capture && (
        <>
          <div className="flex flex-col gap-1 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <p className="flex items-center gap-1 text-sm font-medium text-foreground">
              <PawPrint className="size-4" />
              {capture.header.entityName || capture.header.entityId}
            </p>
            <p>{capture.header.entityId}</p>
            <p>
              {captureName || "已载入"} · {capture.sizeX}×{capture.sizeY}×{capture.sizeZ} 模型像素 ·{" "}
              {capture.header.mcVersion}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="capture-magnification">
              放大倍率：<span className="font-normal text-muted-foreground">{magDraft}×</span>
            </Label>
            <input
              id="capture-magnification"
              type="range"
              min={MAG_MIN}
              max={MAG_MAX}
              step={1}
              value={magDraft}
              onChange={(e) => setMagDraft(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>内部处理</Label>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              <Button
                variant={interior === "hollow" ? "default" : "ghost"}
                size="sm"
                onClick={() => setInterior("hollow")}
              >
                空心
              </Button>
              <Button
                variant={interior === "fill" ? "default" : "ghost"}
                size="sm"
                onClick={() => setInterior("fill")}
              >
                填充
              </Button>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={cull} onCheckedChange={(checked) => setCull(checked === true)} />
              剔除内部不可见方块
            </label>
          </div>

          {interior === "fill" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="capture-filler">填充方块</Label>
              <select
                id="capture-filler"
                value={filler}
                onChange={(e) => setFiller(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {SOLID_BLOCKS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {model ? (
              <>
                <p>
                  总体尺寸：
                  <span className="font-medium text-foreground">
                    {model.sizeX}×{model.sizeY}×{model.sizeZ}
                  </span>
                </p>
                <p>
                  共 <span className="font-medium text-foreground">{total}</span> 个方块
                </p>
                {captureInfo && captureInfo.downsample > 1 && (
                  <p className="text-amber-600 dark:text-amber-500">
                    体素过多，已按 1/{captureInfo.downsample} 分辨率预览（原始{" "}
                    {captureInfo.nativeSize.join("×")} → {captureInfo.effectiveSize.join("×")}）
                  </p>
                )}
              </>
            ) : (
              <p className="text-destructive">{error ?? "无法生成"}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
