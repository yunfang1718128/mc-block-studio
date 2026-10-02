import { create } from "zustand";
import { BLOCKS, SOLID_BLOCKS } from "@/lib/blocks";
import type { CropRect } from "@/lib/imaging/crop";
import type { SampleAlgorithm } from "@/lib/imaging/sample";
import type { ImageSource } from "@/lib/imaging/sample";
import type { Orientation } from "@/lib/voxel/from-image";
import type { CaptureInterior } from "@/lib/voxel/from-capture";
import type { McvoxCapture } from "@/lib/voxel/mcvox";

export type Mode = "image" | "block" | "mob";
export type ViewMode = "2d" | "3d";
export type PreviewZoom = "fit" | "100%";

interface StudioState {
  allowed: Set<string>;
  toggleBlock: (id: string) => void;
  setCategory: (category: string, enabled: boolean) => void;
  setAll: (enabled: boolean) => void;

  mode: Mode;
  setMode: (mode: Mode) => void;
  viewMode: ViewMode;
  setViewMode: (viewMode: ViewMode) => void;
  zoom: PreviewZoom;
  setZoom: (zoom: PreviewZoom) => void;

  source: ImageSource | null;
  sourceName: string;
  setSource: (source: ImageSource | null, name?: string) => void;
  /** Region of the source image to convert, in source pixels. `null` = full image. */
  crop: CropRect | null;
  setCrop: (crop: CropRect | null) => void;
  algorithm: SampleAlgorithm;
  setAlgorithm: (algorithm: SampleAlgorithm) => void;
  orientation: Orientation;
  setOrientation: (orientation: Orientation) => void;
  thickness: number;
  setThickness: (thickness: number) => void;
  size: number;
  setSize: (size: number) => void;

  selectedBlockId: string | null;
  selectBlock: (id: string) => void;
  magnification: number;
  setMagnification: (magnification: number) => void;

  /** A parsed `.mcvox` entity capture, or `null` before one is loaded. */
  capture: McvoxCapture | null;
  captureName: string;
  setCapture: (capture: McvoxCapture | null, name?: string) => void;
  captureMagnification: number;
  setCaptureMagnification: (magnification: number) => void;
  captureInterior: CaptureInterior;
  setCaptureInterior: (interior: CaptureInterior) => void;
  /** Block id (without namespace) used to fill hidden interior voxels. */
  captureFiller: string;
  setCaptureFiller: (id: string) => void;

  exportName: string;
  setExportName: (name: string) => void;

  /** The canvas currently showing a 2D preview, if any. */
  previewCanvas: HTMLCanvasElement | null;
  setPreviewCanvas: (canvas: HTMLCanvasElement | null) => void;
}

// Functional blocks are replica sources only — never part of the palette.
const SOLID_IDS = new Set(SOLID_BLOCKS.map((b) => b.id));

export const useStudio = create<StudioState>((set) => ({
  allowed: new Set(SOLID_IDS),
  toggleBlock: (id) =>
    set((state) => {
      const allowed = new Set(state.allowed);
      if (allowed.has(id)) allowed.delete(id);
      else allowed.add(id);
      return { allowed };
    }),
  setCategory: (category, enabled) =>
    set((state) => {
      const allowed = new Set(state.allowed);
      for (const block of BLOCKS) {
        if (!SOLID_IDS.has(block.id) || block.category !== category) continue;
        if (enabled) allowed.add(block.id);
        else allowed.delete(block.id);
      }
      return { allowed };
    }),
  setAll: (enabled) => set({ allowed: enabled ? new Set(SOLID_IDS) : new Set() }),

  mode: "image",
  setMode: (mode) => set({ mode }),
  viewMode: "2d",
  setViewMode: (viewMode) => set({ viewMode }),
  zoom: "fit",
  setZoom: (zoom) => set({ zoom }),

  source: null,
  sourceName: "",
  setSource: (source, name) => set({ source, sourceName: name ?? "", crop: null }),
  crop: null,
  setCrop: (crop) => set({ crop }),
  algorithm: "auto",
  setAlgorithm: (algorithm) => set({ algorithm }),
  orientation: "wall",
  setOrientation: (orientation) => set({ orientation }),
  thickness: 1,
  setThickness: (thickness) => set({ thickness }),
  size: 32,
  setSize: (size) => set({ size }),

  selectedBlockId: null,
  selectBlock: (id) => set({ selectedBlockId: id }),
  magnification: 3,
  setMagnification: (magnification) => set({ magnification }),

  capture: null,
  captureName: "",
  setCapture: (capture, name) => set({ capture, captureName: name ?? "" }),
  captureMagnification: 2,
  setCaptureMagnification: (captureMagnification) => set({ captureMagnification }),
  captureInterior: "hollow",
  setCaptureInterior: (captureInterior) => set({ captureInterior }),
  captureFiller: "stone",
  setCaptureFiller: (captureFiller) => set({ captureFiller }),

  exportName: "pixel-art",
  setExportName: (exportName) => set({ exportName }),

  previewCanvas: null,
  setPreviewCanvas: (previewCanvas) => set({ previewCanvas }),
}));
