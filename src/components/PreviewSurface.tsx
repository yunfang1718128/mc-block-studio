import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { fitScale } from "@/lib/imaging/fit";
import { cn } from "@/lib/utils";
import { useStudio, type PreviewZoom } from "@/state/store";

type RenderMode = "pixelated" | "auto";

interface PreviewSurfaceProps {
  /** Canvas backing size in CSS pixels (before any display scaling). */
  width: number;
  height: number;
  children: (renderMode: RenderMode) => ReactNode;
  /** Pinned just below the preview, e.g. a size caption. */
  overlay?: ReactNode;
}

const ZOOM_OPTIONS: { value: PreviewZoom; label: string }[] = [
  { value: "fit", label: "适应" },
  { value: "100%", label: "100%" },
];

function measure(element: HTMLDivElement): { w: number; h: number } {
  const style = getComputedStyle(element);
  const px = (value: string) => Number.parseFloat(value) || 0;
  return {
    w: element.clientWidth - px(style.paddingLeft) - px(style.paddingRight),
    h: element.clientHeight - px(style.paddingTop) - px(style.paddingBottom),
  };
}

/**
 * Scroll-safe preview frame shared by both 2D previews.
 *
 * The child is centred with `margin:auto` rather than flexbox centring — with
 * `overflow:auto`, `align-items:center` pushes the overflow past the scroll
 * origin, so the top and left of a large canvas become unreachable. Auto
 * margins centre only when there is free space and otherwise resolve to zero,
 * leaving the whole canvas scrollable.
 */
export function PreviewSurface({ width, height, children, overlay }: PreviewSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const zoom = useStudio((s) => s.zoom);
  const setZoom = useStudio((s) => s.setZoom);
  const [avail, setAvail] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (element) setAvail(measure(element));
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setAvail(measure(element)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = zoom === "fit" ? fitScale(avail.w, avail.h, width, height) : 1;
  const renderMode: RenderMode = scale < 1 ? "auto" : "pixelated";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={ref} data-testid="preview-scroll" className="flex min-h-0 flex-1 overflow-auto p-6">
        <div className="m-auto shrink-0" style={{ width: width * scale, height: height * scale }}>
          {children(renderMode)}
        </div>
      </div>

      <div className="pointer-events-none absolute left-3 top-3 z-10 inline-flex overflow-hidden rounded-md shadow ring-1 ring-gray-200 dark:ring-zinc-700">
        {ZOOM_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setZoom(option.value)}
            className={cn(
              "pointer-events-auto px-2.5 py-1 text-xs font-medium transition-colors",
              zoom === option.value
                ? "bg-primary text-primary-foreground"
                : "bg-white text-gray-900 hover:bg-gray-100 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {overlay && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
          {overlay}
        </div>
      )}
    </div>
  );
}

export type { RenderMode };
