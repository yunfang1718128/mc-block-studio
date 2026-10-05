import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BLOCKS, BLOCKS_BY_ID, textureUrl } from "@/lib/blocks";
import { FACE_DIRS, type BlockInfo, type FaceDir } from "@/lib/blocks/types";
import { buildPalette, matchGrid } from "@/lib/color/match";
import { buildCapture } from "@/lib/voxel/from-capture";
import {
  analyzeComplexity,
  sampleImage,
  type ComplexityReport,
  type SampleAlgorithm,
} from "@/lib/imaging/sample";
import { cropImageSource } from "@/lib/imaging/crop";
import { loadImageSource } from "@/lib/imaging/load";
import { buildBlockReplica, type ReplicaTextures } from "@/lib/voxel/from-block";
import { buildFlatImage, previewFaceFor, toBlockState } from "@/lib/voxel/from-image";
import { buildReplicaFaceMap, type ReplicaFaceMap } from "@/lib/voxel/replica-map";
import type { VoxelModel } from "@/lib/voxel/model";
import { useStudio } from "./store";

/** Layout details for a built mob capture (`null` outside mob mode). */
export interface CaptureInfo {
  /** Integer downsampling factor applied to the native capture (1 = none). */
  downsample: number;
  nativeSize: [number, number, number];
  effectiveSize: [number, number, number];
}

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
  /** Mob capture layout, including any forced downsampling. */
  captureInfo: CaptureInfo | null;
  /** Human-readable generation error, if the current input could not be built. */
  error: string | null;
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
  captureInfo: null,
  error: null,
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

interface GenerationContextValue {
  generation: Generation;
  report: ComplexityReport | null;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

/**
 * Computes the voxel model and preview data exactly once for the whole tree.
 *
 * Everything downstream (preview, export bar, side panel) reads the shared
 * value instead of re-running the expensive sampling + matching pipeline, and
 * the complexity report is memoised against the source image alone so it is
 * never recomputed when only the output size or orientation changes.
 */
export function GenerationProvider({ children }: { children: ReactNode }) {
  const mode = useStudio((s) => s.mode);
  const allowed = useStudio((s) => s.allowed);
  const source = useStudio((s) => s.source);
  const crop = useStudio((s) => s.crop);
  const algorithm = useStudio((s) => s.algorithm);
  const orientation = useStudio((s) => s.orientation);
  const thickness = useStudio((s) => s.thickness);
  const size = useStudio((s) => s.size);
  const selectedBlockId = useStudio((s) => s.selectedBlockId);
  const magnification = useStudio((s) => s.magnification);
  const capture = useStudio((s) => s.capture);
  const captureMagnification = useStudio((s) => s.captureMagnification);
  const captureInterior = useStudio((s) => s.captureInterior);
  const captureFiller = useStudio((s) => s.captureFiller);

  const textures = useReplicaTextures(mode === "block" ? selectedBlockId : null);

  const palette = useMemo(
    () => buildPalette(BLOCKS.filter((b) => b.kind === "solid" && allowed.has(b.id))),
    [allowed]
  );

  // Everything downstream works on the cropped source, if a crop is set.
  const cropped = useMemo(
    () => (source && crop ? cropImageSource(source, crop) : source),
    [source, crop]
  );

  // Full-image analysis depends only on the (cropped) source, never on the output size.
  const report = useMemo(() => (cropped ? analyzeComplexity(cropped) : null), [cropped]);

  // Resolve "auto" a single time so sampling never re-analyses the image.
  const resolvedAlgorithm: SampleAlgorithm = useMemo(() => {
    if (algorithm !== "auto") return algorithm;
    return report?.recommended ?? "nearest";
  }, [algorithm, report]);

  const image = useMemo<Generation>(() => {
    if (mode !== "image" || !cropped) return EMPTY;
    const { width, height } = gridForImage(cropped.width, cropped.height, size);
    const colors = sampleImage(cropped, width, height, resolvedAlgorithm);
    const preview = matchGrid(colors, palette);

    return {
      model: buildFlatImage(colors, width, height, palette, { orientation, thickness }),
      preview,
      previewWidth: width,
      previewHeight: height,
      previewFace: previewFaceFor(orientation),
      report,
      textures: null,
      blockMap: null,
      captureInfo: null,
      error: null,
    };
  }, [mode, cropped, size, resolvedAlgorithm, palette, orientation, thickness, report]);

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
      captureInfo: null,
      error: null,
    };
  }, [mode, textures, palette, magnification]);

  const mob = useMemo<Generation>(() => {
    if (mode !== "mob" || !capture) return EMPTY;
    const fillerBlock = BLOCKS_BY_ID.get(captureFiller);
    const filler = fillerBlock ? toBlockState(fillerBlock) : null;
    try {
      const built = buildCapture(capture, palette, {
        magnification: captureMagnification,
        interior: captureInterior,
        filler,
      });
      return {
        model: built.model,
        preview: null,
        previewWidth: 0,
        previewHeight: 0,
        previewFace: "south",
        report: null,
        textures: null,
        blockMap: null,
        captureInfo: {
          downsample: built.downsample,
          nativeSize: built.nativeSize,
          effectiveSize: built.effectiveSize,
        },
        error: null,
      };
    } catch (err) {
      return { ...EMPTY, error: err instanceof Error ? err.message : "生成失败" };
    }
  }, [mode, capture, captureMagnification, captureInterior, captureFiller, palette]);

  const generation = mode === "image" ? image : mode === "block" ? block : mob;
  const value = useMemo<GenerationContextValue>(() => ({ generation, report }), [generation, report]);

  return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>;
}

function useGenerationContext(): GenerationContextValue {
  const value = useContext(GenerationContext);
  if (!value) {
    throw new Error("useGeneration 必须在 <GenerationProvider> 内使用");
  }
  return value;
}

/** Derive the current voxel model and preview data from the studio state. */
export function useGeneration(): Generation {
  return useGenerationContext().generation;
}

/** Read the (source-only) complexity report without triggering generation. */
export function useComplexityReport(): ComplexityReport | null {
  return useGenerationContext().report;
}
