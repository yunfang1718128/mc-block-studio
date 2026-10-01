import type { ImageSource } from "./sample";

/** Decode an image URL (or object URL) into raw pixel data. */
export function loadImageSource(url: string): Promise<ImageSource> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("无法创建画布上下文"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve({ data, width: canvas.width, height: canvas.height });
    };
    img.onerror = () => reject(new Error("无法读取图片"));
    img.src = url;
  });
}

/** Decode a user-selected file into raw pixel data. */
export async function fileToImageSource(file: File): Promise<ImageSource> {
  const url = URL.createObjectURL(file);
  try {
    return await loadImageSource(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
