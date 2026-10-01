import { useEffect, useMemo, useState } from "react";
import { BLOCKS, textureUrl } from "@/lib/blocks";
import { FACE_DIRS, type BlockInfo, type FaceDir } from "@/lib/blocks/types";
import { buildPalette, matchGrid } from "@/lib/color/match";
import { analyzeComplexity, sampleImage, type ComplexityReport } from "@/lib/imaging/sample";
import { loadImageSource } from "@/lib/imaging/load";
import { buildBlockReplica, type ReplicaTextures } from "@/lib/voxel/from-block";
import { buildFlatImage, previewFaceFor } from "@/lib/voxel/from-image";
import { buildReplicaFaceMap, type ReplicaFaceMap } from "@/lib/voxel/replica-map";
import type { VoxelModel } from "@/lib/voxel/model";
import { useStudio } from "./store";

export interface Generation {
  model: VoxelModel | null;
  /** Matched blocks for the flat 2D preview, row-major (image mode). */
  preview: (BlockInfo | null)[] | null;
  previewWidth: number;
  previewHeight: number;
  /** Which face the 2D preview shows (image mode). */
  previewFace: FaceDir;
  report: ComplexityReport | null;
  textures: ReplicaTextures | null;
  /** Six-face matched grids for the cube-net preview (block mode). */
  blockMap: ReplicaFaceMap | null;
}

const EMPTY: Generation = {
  model: null,
  preview: null,
  previewWidth: 0,
  previewHeight: 0,
  previewFace: "south",
  report: null,
  textures: null,
  blockMap: null,
};

/** Load the six face textures for the chosen source block. */
export function useReplicaTextures(blockId: string | null): ReplicaTextures | null {
  const [textures, setTextures] = useState<ReplicaTextures | null>(null);

  useEffect(() => {
    if (!blockId) {
      setTextures(null);
      return;
    }
    const block = BLOCKS.find((b) => b.id === blockId);
    if (!block) {
      setTextures(null);
      return;
    }

    let cancelled = false;
    const names = [...new Set(Object.values(block.faces))];
    Promise.all(names.map(async (name) => [name, await loadImageSource(textureUrl(name))] as const))
      .then((pairs) => {
        if (cancelled) return;
        const byName = new Map(pairs);
        const resolved = {} as ReplicaTextures;
        for (const dir of FACE_DIRS) {
          const image = byName.get(block.faces[dir]);
          if (image) resolved[dir] = image;
        }
        setTextures(Object.keys(resolved).length === FACE_DIRS.length ? resolved : null);
      })
      .catch(() => {
        if (!cancelled) setTextures(null);
      });

    return () => {
      cancelled = true;
    };
  }, [blockId]);

  return textures;
}

/** Resolve the output grid for an image, keeping its aspect ratio. */
export function gridForImage(width: number, height: number, longest: number) {
  if (width >= height) {
    return { width: longest, height: Math.max(1, Math.round((longest * height) / width)) };
  }
  return { width: Math.max(1, Math.round((longest * width) / height)), height: longest };
}

/** Derive the current voxel model and preview data from the studio state. */
export function useGeneration(): Generation {
  const mode = useStudio((s) => s.mode);
  const allowed = useStudio((s) => s.allowed);
  const source = useStudio((s) => s.source);
  const algorithm = useStudio((s) => s.algorithm);
  const orientation = useStudio((s) => s.orientation);
  const thickness = useStudio((s) => s.thickness);
  const size = useStudio((s) => s.size);
  const selectedBlockId = useStudio((s) => s.selectedBlockId);
  const magnification = useStudio((s) => s.magnification);

  const textures = useReplicaTextures(mode === "block" ? selectedBlockId : null);

  const palette = useMemo(
    () => buildPalette(BLOCKS.filter((b) => b.kind === "solid" && allowed.has(b.id))),
    [allowed]
  );

  const image = useMemo<Generation>(() => {
    if (mode !== "image" || !source) return EMPTY;
    const { width, height } = gridForImage(source.width, source.height, size);
    const colors = sampleImage(source, width, height, algorithm);
    const preview = matchGrid(colors, palette);

    return {
      model: buildFlatImage(colors, width, height, palette, { orientation, thickness }),
      preview,
      previewWidth: width,
      previewHeight: height,
      previewFace: previewFaceFor(orientation),
      report: analyzeComplexity(source),
      textures: null,
      blockMap: null,
    };
  }, [mode, source, size, algorithm, palette, orientation, thickness]);

  const block = useMemo<Generation>(() => {
    if (mode !== "block" || !textures) return EMPTY;
    return {
      model: buildBlockReplica(textures, palette, { magnification }),
      preview: null,
      previewWidth: 0,
      previewHeight: 0,
      previewFace: "south",
      report: null,
      textures,
      blockMap: buildReplicaFaceMap(textures, palette),
    };
  }, [mode, textures, palette, magnification]);

  return mode === "image" ? image : block;
}
