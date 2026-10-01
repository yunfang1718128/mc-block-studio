import { useEffect, useMemo, useRef } from "react";
import type { FaceDir } from "@/lib/blocks/types";
import { useTextureImages } from "@/lib/imaging/textureCache";
import type { RenderMode } from "@/components/PreviewSurface";
import type { ReplicaFaceMap } from "@/lib/voxel/replica-map";
import { useStudio } from "@/state/store";

const TEXTURE_PX = 16;
export const NET_COLS = 3;
export const NET_ROWS = 4;

/** Cube net: four sides wrapped around the middle, top above, bottom below. */
const LAYOUT: { dir: FaceDir; col: number; row: number }[] = [
  { dir: "top", col: 1, row: 0 },
  { dir: "west", col: 0, row: 1 },
  { dir: "north", col: 1, row: 1 },
  { dir: "east", col: 2, row: 1 },
  { dir: "bottom", col: 1, row: 2 },
  { dir: "south", col: 1, row: 3 },
];

export function BlockPreview2D({ map, renderMode }: { map: ReplicaFaceMap; renderMode: RenderMode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const setPreviewCanvas = useStudio((s) => s.setPreviewCanvas);

  const names = useMemo(() => {
    const set = new Set<string>();
    for (const { dir } of LAYOUT) {
      for (const block of map.faces[dir]) if (block) set.add(block.faces[dir]);
    }
    return [...set];
  }, [map]);

  const images = useTextureImages(names);

  const facePx = map.size * TEXTURE_PX;
  const canvasW = NET_COLS * facePx;
  const canvasH = NET_ROWS * facePx;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvasW, canvasH);

    for (const { dir, col, row } of LAYOUT) {
      const cells = map.faces[dir];
      const ox = col * facePx;
      const oy = row * facePx;
      for (let y = 0; y < map.size; y++) {
        for (let x = 0; x < map.size; x++) {
          const block = cells[y * map.size + x];
          if (!block) continue;
          const tex = images.get(block.faces[dir]);
          if (!tex) continue;
          ctx.drawImage(
            tex,
            0,
            0,
            TEXTURE_PX,
            TEXTURE_PX,
            ox + x * TEXTURE_PX,
            oy + y * TEXTURE_PX,
            TEXTURE_PX,
            TEXTURE_PX
          );
        }
      }
      ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
      ctx.strokeRect(ox + 0.5, oy + 0.5, facePx - 1, facePx - 1);
    }
  }, [map, images, canvasW, canvasH, facePx]);

  useEffect(() => {
    setPreviewCanvas(ref.current);
    return () => setPreviewCanvas(null);
  }, [setPreviewCanvas]);

  return (
    <canvas
      ref={ref}
      data-testid="block-preview-canvas"
      className="block size-full rounded-md shadow-sm ring-1 ring-black/10 dark:ring-white/10"
      style={{ imageRendering: renderMode }}
    />
  );
}
