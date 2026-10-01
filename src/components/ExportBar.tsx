import { useMemo, useState } from "react";
import { Download, ImageDown } from "lucide-react";
import { BLOCKS } from "@/lib/blocks";
import { downloadBlob } from "@/lib/download";
import { sanitizeName, saveLitematic } from "@/lib/litematic/export";
import { countBlocks, nonAirCount } from "@/lib/voxel/model";
import { useStudio } from "@/state/store";
import { useGeneration } from "@/state/useGeneration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NAME_BY_ID = new Map(BLOCKS.map((b) => [`minecraft:${b.id}`, b.name]));

export function ExportBar() {
  const model = useGeneration().model;
  const exportName = useStudio((s) => s.exportName);
  const setExportName = useStudio((s) => s.setExportName);
  const previewCanvas = useStudio((s) => s.previewCanvas);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const materials = useMemo(() => (model ? countBlocks(model) : []), [model]);
  const total = useMemo(() => (model ? nonAirCount(model) : 0), [model]);

  async function onDownloadImage() {
    if (!previewCanvas) return;
    const blob = await new Promise<Blob | null>((resolve) => previewCanvas.toBlob(resolve, "image/png"));
    if (!blob) {
      setStatus("预览图导出失败");
      return;
    }
    downloadBlob(blob, `${sanitizeName(exportName)}.png`);
    setStatus("已下载预览图");
  }

  async function onSave() {
    if (!model) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await saveLitematic(model, exportName);
      if (result === "saved") {
        setStatus("已保存");
        setOpen(false);
      } else if (result === "downloaded") {
        setStatus("已下载到浏览器默认位置");
        setOpen(false);
      }
    } catch {
      setStatus("导出失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      data-testid="action-bar"
      className="flex items-center justify-between gap-4 border-t border-border bg-card px-4 py-3"
    >
      <div className="min-w-0 text-xs text-muted-foreground">
        {model ? (
          <span>
            {model.sizeX}×{model.sizeY}×{model.sizeZ} · 共 {total} 个方块 · {materials.length} 种材料
          </span>
        ) : (
          <span>尚无生成结果</span>
        )}
        {status && <span className="ml-3 text-foreground">{status}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" disabled={!previewCanvas} onClick={onDownloadImage}>
          <ImageDown />
          下载预览图
        </Button>
        <Button disabled={!model} onClick={() => setOpen(true)}>
          <Download />
          确定并导出
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导出 Litematica</DialogTitle>
            <DialogDescription>生成 .litematic 文件，可在 Minecraft 的投影模组中加载。</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="export-name">文件名</Label>
            <Input
              id="export-name"
              value={exportName}
              onChange={(e) => setExportName(e.target.value)}
              placeholder="pixel-art"
            />
          </div>

          <div className="rounded-lg border border-gray-100 dark:border-zinc-800">
            <div className="border-b border-gray-100 px-3 py-2 text-sm font-medium dark:border-zinc-800">
              材料清单（{materials.length} 种，共 {total} 个方块）
            </div>
            <ul className="max-h-56 overflow-y-auto px-3 py-2 text-sm">
              {materials.slice(0, 30).map((m) => (
                <li key={m.state.name} className="flex items-center justify-between py-0.5">
                  <span>{NAME_BY_ID.get(m.state.name) ?? m.state.name}</span>
                  <span className="text-muted-foreground">×{m.count}</span>
                </li>
              ))}
              {materials.length > 30 && (
                <li className="py-0.5 text-muted-foreground">…还有 {materials.length - 30} 种</li>
              )}
            </ul>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              取消
            </Button>
            <Button onClick={onSave} disabled={busy}>
              <Download />
              保存文件
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
