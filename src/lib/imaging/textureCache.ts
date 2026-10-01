import { useEffect, useState } from "react";
import { textureUrl } from "../blocks";

const cache = new Map<string, Promise<HTMLImageElement>>();

/** Load (and memoise) a block texture as an `HTMLImageElement`. */
export function loadTexture(name: string): Promise<HTMLImageElement> {
  let entry = cache.get(name);
  if (!entry) {
    entry = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`无法加载贴图 ${name}`));
      img.src = textureUrl(name);
    });
    cache.set(name, entry);
  }
  return entry;
}

/**
 * Ensure every texture in `names` is loaded, re-rendering when they arrive.
 * Missing textures are simply absent from the returned map.
 */
export function useTextureImages(names: readonly string[]): Map<string, HTMLImageElement> {
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(() => new Map());
  const key = [...new Set(names)].sort().join("\n");

  useEffect(() => {
    if (!key) {
      setImages(new Map());
      return;
    }
    let cancelled = false;
    const unique = key.split("\n");
    Promise.all(
      unique.map(async (name) => {
        try {
          return [name, await loadTexture(name)] as const;
        } catch {
          return null;
        }
      })
    ).then((pairs) => {
      if (cancelled) return;
      const map = new Map<string, HTMLImageElement>();
      for (const pair of pairs) if (pair) map.set(pair[0], pair[1]);
      setImages(map);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return images;
}
