import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BLOCKS, BLOCKS_BY_ID, textureUrl } from "@/lib/blocks";
import { FACE_DIRS, type BlockInfo, type FaceDir } from "@/lib/blocks/types";
import { buildPalette, matchGrid, type PaletteEntry } from "@/lib/color/match";
import { buildCapture, type CaptureInterior } from "@/lib/voxel/from-capture";
import type { McvoxCapture } from "@/lib/voxel/mcvox";
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

interface CaptureBuildOptions {
  magnification: number;
  interior: CaptureInterior;
  cull: boolean;
  /** Catalogue id (without namespace) of the interior filler block. */
  filler: string;
}

/**
 * Expand a `.mcvox` capture into a voxel model. Shared by the mob tab and the
 * block tab's upload source — both consume the same format through the same
 * pipeline, and only differ in where the capture comes from.
 */
function buildCaptureGeneration(
  capture: McvoxCapture,
  palette: readonly PaletteEntry[],
  options: CaptureBuildOptions
): Generation {
  const fillerBlock = BLOCKS_BY_ID.get(options.filler);
  try {
    const built = buildCapture(capture, palette, {
      magnification: options.magnification,
      interior: options.interior,
      cull: options.cull,
      filler: fillerBlock ? toBlockState(fillerBlock) : null,
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
}

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
  const captureCull = useStudio((s) => s.captureCull);
  const captureFiller = useStudio((s) => s.captureFiller);
  const blockSource = useStudio((s) => s.blockSource);
  const blockCapture = useStudio((s) => s.blockCapture);
  const blockMagnification = useStudio((s) => s.blockMagnification);
  const blockInterior = useStudio((s) => s.blockInterior);
  const blockCull = useStudio((s) => s.blockCull);
  const blockFiller = useStudio((s) => s.blockFiller);

  // Built-in blocks replicate their face textures; an uploaded block capture is
  // a voxel grid instead, so it must not pull the catalogue textures at all.
  const builtinBlockId = mode === "block" && blockSource === "builtin" ? selectedBlockId : null;
  const textures = useReplicaTextures(builtinBlockId);

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
    if (mode !== "block") return EMPTY;
    if (blockSource === "upload") {
      if (!blockCapture) return EMPTY;
      return buildCaptureGeneration(blockCapture, palette, {
        magnification: blockMagnification,
        interior: blockInterior,
        cull: blockCull,
        filler: blockFiller,
      });
    }
    if (!textures) return EMPTY;
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
  }, [
    mode,
    blockSource,
    blockCapture,
    blockMagnification,
    blockInterior,
    blockCull,
    blockFiller,
    textures,
    palette,
    magnification,
  ]);

  const mob = useMemo<Generation>(() => {
    if (mode !== "mob" || !capture) return EMPTY;
    return buildCaptureGeneration(capture, palette, {
      magnification: captureMagnification,
      interior: captureInterior,
      cull: captureCull,
      filler: captureFiller,
    });
  }, [mode, capture, captureMagnification, captureInterior, captureCull, captureFiller, palette]);

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
