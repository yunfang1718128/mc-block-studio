import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import {
  CROP_ASPECTS,
  clampRect,
  isFullCrop,
  largestRectForRatio,
  rectForDrag,
  rectForEdgeDrag,
  type CropRect,
} from "@/lib/imaging/crop";
import type { ImageSource } from "@/lib/imaging/sample";
import { cn } from "@/lib/utils";
import { useStudio } from "@/state/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CornerHandle = "nw" | "ne" | "se" | "sw";
type EdgeHandle = "n" | "e" | "s" | "w";
type HandleId = CornerHandle | EdgeHandle;
type DragMode = "move" | HandleId;

const CORNERS: readonly CornerHandle[] = ["nw", "ne", "se", "sw"];
const EDGES: readonly EdgeHandle[] = ["n", "e", "s", "w"];

/** Fixed opposite corner for each corner handle. */
const ANCHOR: Record<CornerHandle, (r: CropRect) => { x: number; y: number }> = {
  nw: (r) => ({ x: r.x + r.width, y: r.y + r.height }),
  ne: (r) => ({ x: r.x, y: r.y + r.height }),
  se: (r) => ({ x: r.x, y: r.y }),
  sw: (r) => ({ x: r.x + r.width, y: r.y }),
};

type HandleStyle = { style: React.CSSProperties; cursor: string };

const HANDLE_STYLE: Record<HandleId, HandleStyle> = {
  nw: { style: { left: 0, top: 0, transform: "translate(-50%, -50%)" }, cursor: "nwse-resize" },
  ne: { style: { right: 0, top: 0, transform: "translate(50%, -50%)" }, cursor: "nesw-resize" },
  se: { style: { right: 0, bottom: 0, transform: "translate(50%, 50%)" }, cursor: "nwse-resize" },
  sw: { style: { left: 0, bottom: 0, transform: "translate(-50%, 50%)" }, cursor: "nesw-resize" },
  n: { style: { left: "50%", top: 0, transform: "translate(-50%, -50%)" }, cursor: "ns-resize" },
  s: { style: { left: "50%", bottom: 0, transform: "translate(-50%, 50%)" }, cursor: "ns-resize" },
  w: { style: { left: 0, top: "50%", transform: "translate(-50%, -50%)" }, cursor: "ew-resize" },
  e: { style: { right: 0, top: "50%", transform: "translate(50%, -50%)" }, cursor: "ew-resize" },
};

interface DragState {
  mode: DragMode;
  startPointer: { x: number; y: number };
  startRect: CropRect;
}

function detectAspect(rect: CropRect, bounds: { width: number; height: number }): string {
  if (isFullCrop(rect, bounds)) return "free";
  const value = rect.width / rect.height;
  const match = CROP_ASPECTS.find((a) => a.ratio && Math.abs(a.ratio.w / a.ratio.h - value) < 1e-3);
  return match?.id ?? "free";
}

export function CropEditor({
  source,
  open,
  onOpenChange,
}: {
  source: ImageSource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const crop = useStudio((s) => s.crop);
  const setCrop = useStudio((s) => s.setCrop);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const bounds = { width: source.width, height: source.height };
  const [rect, setRect] = useState<CropRect>(crop ?? { x: 0, y: 0, ...bounds });
  const [aspectId, setAspectId] = useState(() => detectAspect(crop ?? { x: 0, y: 0, ...bounds }, bounds));
  const [availWidth, setAvailWidth] = useState(0);
  const ratio = CROP_ASPECTS.find((a) => a.id === aspectId)?.ratio ?? null;

  // Scale the image up or down to fill the available space so even small
  // sources are comfortable to crop.
  const maxWidth = Math.max(1, availWidth - 24);
  const maxHeight = Math.max(1, window.innerHeight * 0.54);
  const scale = availWidth > 0 ? Math.min(maxWidth / source.width, maxHeight / source.height) : 1;
  const dispW = Math.max(1, Math.round(source.width * scale));
  const dispH = Math.max(1, Math.round(source.height * scale));

  useEffect(() => {
    if (!open) return;
    const element = containerRef.current;
    if (!element) return;
    const measure = () => setAvailWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imageData = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
    ctx.putImageData(imageData, 0, 0);
  }, [source, open]);

  useEffect(() => {
    if (!open) return;
    const full: CropRect = { x: 0, y: 0, width: source.width, height: source.height };
    const initial = clampRect(crop ?? full, source.width, source.height);
    setRect(initial);
    setAspectId(detectAspect(initial, { width: source.width, height: source.height }));
  }, [open, crop, source.width, source.height]);

  const toSourcePoint = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const box = canvas.getBoundingClientRect();
      const scale = box.width / source.width || 1;
      return {
        x: Math.min(source.width, Math.max(0, (event.clientX - box.left) / scale)),
        y: Math.min(source.height, Math.max(0, (event.clientY - box.top) / scale)),
      };
    },
    [source.width, source.height]
  );

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const pointer = toSourcePoint(event);
      const local = { width: source.width, height: source.height };

      if (drag.mode === "move") {
        const dx = pointer.x - drag.startPointer.x;
        const dy = pointer.y - drag.startPointer.y;
        setRect(
          clampRect(
            { ...drag.startRect, x: drag.startRect.x + dx, y: drag.startRect.y + dy },
            local.width,
            local.height
          )
        );
      } else if (drag.mode === "n" || drag.mode === "e" || drag.mode === "s" || drag.mode === "w") {
        setRect(rectForEdgeDrag(drag.startRect, drag.mode, pointer, local));
      } else {
        setRect(rectForDrag(ANCHOR[drag.mode](drag.startRect), pointer, ratio, local));
      }
    }

    function onUp() {
      dragRef.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [ratio, source.width, source.height, toSourcePoint]);

  function beginDrag(mode: DragMode, event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { mode, startPointer: toSourcePoint(event), startRect: rect };
  }

  function selectAspect(id: string) {
    setAspectId(id);
    const preset = CROP_ASPECTS.find((a) => a.id === id);
    if (preset?.ratio) {
      setRect(largestRectForRatio({ width: source.width, height: source.height }, preset.ratio));
    }
  }

  function reset() {
    setRect({ x: 0, y: 0, width: source.width, height: source.height });
    setAspectId("free");
  }

  function apply() {
    const next = clampRect(rect, source.width, source.height);
    setCrop(isFullCrop(next, { width: source.width, height: source.height }) ? null : next);
    onOpenChange(false);
  }

  const selection = {
    left: `${(rect.x / source.width) * 100}%`,
    top: `${(rect.y / source.height) * 100}%`,
    width: `${(rect.width / source.width) * 100}%`,
    height: `${(rect.height / source.height) * 100}%`,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>裁剪图片</DialogTitle>
          <DialogDescription>拖动选框移动，拖动控制点缩放；固定比例会保持宽高比。</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {CROP_ASPECTS.map((aspect) => (
            <button
              key={aspect.id}
              type="button"
              onClick={() => selectAspect(aspect.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                aspectId === aspect.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              )}
            >
              {aspect.label}
            </button>
          ))}
        </div>

        <div ref={containerRef} className="flex max-h-[60vh] justify-center overflow-auto rounded-lg bg-gray-100 p-3 dark:bg-zinc-950/60">
          <div className="relative" style={{ width: dispW, height: dispH }}>
            <canvas
              ref={canvasRef}
              className="block select-none"
              style={{ width: dispW, height: dispH, imageRendering: "pixelated" }}
            />
            <div className="pointer-events-none absolute inset-0">
              <div
                className="pointer-events-auto absolute cursor-move border-2 border-primary"
                style={{ ...selection, boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45)" }}
                onPointerDown={(event) => beginDrag("move", event)}
              >
                {CORNERS.map((handle) => (
                  <div
                    key={handle}
                    onPointerDown={(event) => beginDrag(handle, event)}
                    style={{ ...HANDLE_STYLE[handle].style, cursor: HANDLE_STYLE[handle].cursor }}
                    className="absolute size-3 rounded-sm border border-white bg-primary"
                  />
                ))}
                {ratio === null &&
                  EDGES.map((handle) => (
                    <div
                      key={handle}
                      onPointerDown={(event) => beginDrag(handle, event)}
                      style={{ ...HANDLE_STYLE[handle].style, cursor: HANDLE_STYLE[handle].cursor }}
                      className="absolute size-3 rounded-sm border border-white bg-primary"
                    />
                  ))}
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          裁剪区域：{rect.width}×{rect.height} px · 位置 ({rect.x}, {rect.y})
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={reset}>
            <RotateCcw />
            重置为整图
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={apply}>
            <Check />
            应用裁剪
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
