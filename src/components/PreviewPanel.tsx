import { Boxes, ImageIcon } from "lucide-react";
import { BLOCKS } from "@/lib/blocks";
import { cn } from "@/lib/utils";
import { useStudio, type ViewMode } from "@/state/store";
import { useGeneration } from "@/state/useGeneration";
import { Preview2D, TEXTURE_PX } from "@/components/Preview2D";
import { BlockPreview2D, NET_COLS, NET_ROWS } from "@/components/BlockPreview2D";
import { PreviewSurface } from "@/components/PreviewSurface";
import { Viewer3D } from "@/components/Viewer3D";

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function PreviewPanel() {
  const mode = useStudio((s) => s.mode);
  const viewMode = useStudio((s) => s.viewMode);
  const setViewMode = useStudio((s) => s.setViewMode);
  const selectedBlockId = useStudio((s) => s.selectedBlockId);
  const magnification = useStudio((s) => s.magnification);
  const { model, preview, previewWidth, previewHeight, previewFace, blockMap } = useGeneration();

  const block = selectedBlockId ? BLOCKS.find((b) => b.id === selectedBlockId) : undefined;
  const face = 16 * magnification;

  const imageBounds = !!preview && previewWidth > 0;
  const blockReady = !!block && !!blockMap;
  const hasContent = mode === "image" ? imageBounds : blockReady;

  const missing =
    mode === "image"
      ? { icon: <ImageIcon className="size-8" />, text: "请先在右侧导入图片" }
      : block
        ? { icon: <Boxes className="size-8" />, text: "正在加载贴图…" }
        : { icon: <Boxes className="size-8" />, text: "请先在右侧选择目标方块" };

  const surface =
    mode === "image" && imageBounds
      ? { width: previewWidth * TEXTURE_PX, height: previewHeight * TEXTURE_PX }
      : mode === "block" && blockMap
        ? {
            width: blockMap.size * NET_COLS * TEXTURE_PX,
            height: blockMap.size * NET_ROWS * TEXTURE_PX,
          }
        : null;

  return (
    <section data-testid="preview-panel" className="relative flex min-h-0 flex-1 flex-col bg-muted/30">
      <div className="absolute right-3 top-3 z-10 inline-flex overflow-hidden rounded-md shadow ring-1 ring-gray-200 dark:ring-zinc-700">
        {(["2d", "3d"] as ViewMode[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setViewMode(value)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium transition-colors",
              viewMode === value
                ? "bg-primary text-primary-foreground"
                : "bg-white text-gray-900 hover:bg-gray-100 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            {value.toUpperCase()}
          </button>
        ))}
      </div>

      {viewMode === "3d" ? (
        model && hasContent ? (
          <Viewer3D model={model} />
        ) : (
          <EmptyState icon={missing.icon} text={missing.text} />
        )
      ) : surface ? (
        <PreviewSurface
          width={surface.width}
          height={surface.height}
          overlay={
            mode === "block" && block ? (
              <p className="rounded-md bg-white/85 px-2 py-1 text-xs text-muted-foreground shadow ring-1 ring-gray-200 dark:bg-zinc-900/85 dark:ring-zinc-700">
                {block.name} · 单面 {face}×{face} · 总体 {face}×{face}×{face}
              </p>
            ) : undefined
          }
        >
          {(renderMode) =>
            mode === "image" ? (
              <Preview2D
                grid={preview!}
                width={previewWidth}
                height={previewHeight}
                face={previewFace}
                renderMode={renderMode}
              />
            ) : (
              <BlockPreview2D map={blockMap!} renderMode={renderMode} />
            )
          }
        </PreviewSurface>
      ) : (
        <EmptyState icon={missing.icon} text={missing.text} />
      )}
    </section>
  );
}
