import { useEffect, useMemo, useRef } from "react";
import type { BlockInfo, FaceDir } from "@/lib/blocks/types";
import { useTextureImages } from "@/lib/imaging/textureCache";
import type { RenderMode } from "@/components/PreviewSurface";
import { useStudio } from "@/state/store";

export const TEXTURE_PX = 16;

interface Preview2DProps {
  grid: (BlockInfo | null)[];
  width: number;
  height: number;
  face: FaceDir;
  renderMode: RenderMode;
}

/** Draws the matched blocks as their face textures, tiled pixel-perfect. */
export function Preview2D({ grid, width, height, face, renderMode }: Preview2DProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const setPreviewCanvas = useStudio((s) => s.setPreviewCanvas);

  const names = useMemo(() => {
    const set = new Set<string>();
    for (const block of grid) if (block) set.add(block.faces[face]);
    return [...set];
  }, [grid, face]);

  const images = useTextureImages(names);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = width * TEXTURE_PX;
    canvas.height = height * TEXTURE_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const block = grid[row * width + col];
        if (!block) continue;
        const tex = images.get(block.faces[face]);
        if (!tex) continue;
        ctx.drawImage(tex, 0, 0, TEXTURE_PX, TEXTURE_PX, col * TEXTURE_PX, row * TEXTURE_PX, TEXTURE_PX, TEXTURE_PX);
      }
    }
  }, [grid, width, height, face, images]);

  useEffect(() => {
    setPreviewCanvas(ref.current);
    return () => setPreviewCanvas(null);
  }, [setPreviewCanvas]);

  return (
    <canvas
      ref={ref}
      data-testid="pixel-art-canvas"
      className="block size-full rounded-md shadow-sm ring-1 ring-black/10 dark:ring-white/10"
      style={{ imageRendering: renderMode }}
    />
  );
}
