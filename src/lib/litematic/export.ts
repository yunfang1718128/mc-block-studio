import { downloadBlob } from "../download";
import type { VoxelModel } from "../voxel/model";
import { encodeLitematic, type EncodeOptions } from "./encode";

export type SaveResult = "saved" | "downloaded" | "cancelled";

interface WritableLike {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

interface FileHandleLike {
  createWritable(): Promise<WritableLike>;
}

interface SavePickerOptions {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SavePickerOptions) => Promise<FileHandleLike>;
  }
}

/** Strip characters illegal in filenames, falling back when empty. */
export function sanitizeName(name: string, fallback = "pixel-art"): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length ? cleaned : fallback;
}

/** Strip characters illegal in filenames and guarantee the `.litematic` suffix. */
export function sanitizeFilename(name: string, fallback = "pixel-art"): string {
  const base = sanitizeName(name, fallback);
  return base.toLowerCase().endsWith(".litematic") ? base : `${base}.litematic`;
}

/**
 * Encode `model` and write it to disk.
 *
 * Uses the File System Access API when available so the user can pick a
 * location, and falls back to an `<a download>` otherwise. Returns
 * `"cancelled"` when the user dismisses the save picker.
 */
export async function saveLitematic(
  model: VoxelModel,
  name: string,
  options: Omit<EncodeOptions, "name"> = {}
): Promise<SaveResult> {
  const bytes = encodeLitematic(model, { ...options, name });
  const filename = sanitizeFilename(name);

  if (typeof window !== "undefined" && window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Minecraft Litematica", accept: { "application/octet-stream": [".litematic"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(bytes);
      await writable.close();
      return "saved";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // Any other failure (unsupported context, permissions) falls back to download.
    }
  }

  downloadBlob(new Blob([bytes as BlobPart], { type: "application/octet-stream" }), filename);
  return "downloaded";
}
