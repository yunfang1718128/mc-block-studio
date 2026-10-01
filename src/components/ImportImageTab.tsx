import { useRef } from "react";
import { ImageUp, Sparkles } from "lucide-react";
import type { SampleAlgorithm } from "@/lib/imaging/sample";
import { fileToImageSource } from "@/lib/imaging/load";
import { useStudio } from "@/state/store";
import { useGeneration } from "@/state/useGeneration";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const ALGORITHMS: { value: SampleAlgorithm; label: string }[] = [
  { value: "auto", label: "自动（按图片复杂度）" },
  { value: "nearest", label: "最近邻（中心像素）" },
  { value: "average", label: "区域平均（箱式）" },
  { value: "median", label: "中位数（主色）" },
  { value: "lanczos", label: "平滑重采样（Lanczos）" },
];

const RECOMMENDED_LABEL: Record<Exclude<SampleAlgorithm, "auto">, string> = {
  nearest: "最近邻",
  average: "区域平均",
  median: "中位数",
  lanczos: "平滑重采样",
};

export function ImportImageTab() {
  const source = useStudio((s) => s.source);
  const sourceName = useStudio((s) => s.sourceName);
  const setSource = useStudio((s) => s.setSource);
  const algorithm = useStudio((s) => s.algorithm);
  const setAlgorithm = useStudio((s) => s.setAlgorithm);
  const orientation = useStudio((s) => s.orientation);
  const setOrientation = useStudio((s) => s.setOrientation);
  const thickness = useStudio((s) => s.thickness);
  const setThickness = useStudio((s) => s.setThickness);
  const size = useStudio((s) => s.size);
  const setSize = useStudio((s) => s.setSize);
  const report = useGeneration().report;
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const image = await fileToImageSource(file);
    setSource(image, file.name);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
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
        <ImageUp className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium">点击选择图片，或拖拽到此处</span>
        <span className="text-xs text-muted-foreground">支持 PNG / JPG / WebP</span>
      </button>

      {source && (
        <p className="text-xs text-muted-foreground">
          {sourceName || "已载入"} · {source.width}×{source.height}px
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="algorithm">采样算法</Label>
        <select
          id="algorithm"
          value={algorithm}
          onChange={(e) => setAlgorithm(e.target.value as SampleAlgorithm)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ALGORITHMS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        {report && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" />
            检测：边缘密度 {(report.edgeDensity * 100).toFixed(0)}%，推荐「
            {RECOMMENDED_LABEL[report.recommended]}」
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>朝向</Label>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <Button
            variant={orientation === "wall" ? "default" : "ghost"}
            size="sm"
            onClick={() => setOrientation("wall")}
          >
            挂墙（X-Y）
          </Button>
          <Button
            variant={orientation === "floor" ? "default" : "ghost"}
            size="sm"
            onClick={() => setOrientation("floor")}
          >
            地面（X-Z）
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="size">
          最长边方块数：<span className="font-normal text-muted-foreground">{size}</span>
        </Label>
        <input
          id="size"
          type="range"
          min={8}
          max={96}
          step={1}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="thickness">厚度（层数）</Label>
        <input
          id="thickness"
          type="number"
          min={1}
          max={8}
          value={thickness}
          onChange={(e) => setThickness(Math.max(1, Number(e.target.value) || 1))}
          className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}
