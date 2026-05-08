import { useState, useCallback, useRef, useEffect } from "react";
import { LEVEL_CANDIDATES, buildColorLUT } from "../color-engine";
import { LEVEL_MASK } from "../constants";
import type { CanvasData } from "../types";

export interface GalleryItem {
  cc: number[];
  imageData: ImageData | null;
}

const THUMB_MAX = 260;
const CHUNK_SIZE = 8;

/** Generate all cc[] variants as a Cartesian product of unlocked candidate indices. */
export function generateAllVariants(cc: number[], locked: boolean[], hist: number[]): number[][] {
  const options: number[][] = [];
  for (let lv = 0; lv < 8; lv++) {
    const n = LEVEL_CANDIDATES[lv].length;
    if (locked[lv] || hist[lv] === 0 || n <= 1) {
      options.push([cc[lv] % n]);
    } else {
      options.push(Array.from({ length: n }, (_, i) => i));
    }
  }

  // Cartesian product
  const results: number[][] = [];
  const recurse = (lv: number, current: number[]) => {
    if (lv === 8) {
      results.push([...current]);
      return;
    }
    for (const idx of options[lv]) {
      current[lv] = idx;
      recurse(lv + 1, current);
    }
  };
  recurse(0, new Array(8).fill(0));
  return results;
}

/** Render a thumbnail ImageData for the given data + colorLUT, optionally with colorMap glaze. */
export function renderThumbnail(
  data: Uint8Array,
  w: number,
  h: number,
  lut: [number, number, number][],
  thumbW: number,
  thumbH: number,
): ImageData {
  const img = new ImageData(thumbW, thumbH);
  const d = img.data;
  const scaleX = w / thumbW,
    scaleY = h / thumbH;
  for (let ty = 0; ty < thumbH; ty++) {
    const sy = Math.min(h - 1, (ty * scaleY) | 0);
    for (let tx = 0; tx < thumbW; tx++) {
      const sx = Math.min(w - 1, (tx * scaleX) | 0);
      const lv = data[sy * w + sx] & LEVEL_MASK;
      const rgb = lut[lv];
      const di = (ty * thumbW + tx) * 4;
      d[di] = rgb[0];
      d[di + 1] = rgb[1];
      d[di + 2] = rgb[2];
      d[di + 3] = 255;
    }
  }
  return img;
}

function calcThumbSize(w: number, h: number): { tw: number; th: number } {
  const scale = Math.min(1, THUMB_MAX / Math.max(w, h));
  return { tw: Math.max(1, Math.round(w * scale)), th: Math.max(1, Math.round(h * scale)) };
}

// Single-app-instance cache shared across hook mounts. This preserves thumbnails
// across tab switches while the Gallery panel is hidden.
const _cache = { items: [] as GalleryItem[] };

// Single-app-instance gallery-regeneration cache. Tracks cvs.data by reference
// identity rather than sampled pixels: canvas-reducer returns a fresh Uint8Array
// on every mutation, so identity equality is a reliable invalidation signal.
const _generationCache = {
  data: null as Uint8Array | null,
  w: 0,
  h: 0,
  variantKey: "",
  locked: "",
  hist: "",
};

function galleryVariantKey(cc: number[], locked: boolean[], hist: number[]): string {
  return LEVEL_CANDIDATES.map((cands, lv) => {
    const n = cands.length;
    if (locked[lv] || hist[lv] === 0 || n <= 1) return String(cc[lv] % n);
    return "*";
  }).join(",");
}

function clearGenerationCache() {
  _generationCache.data = null;
  _generationCache.w = 0;
  _generationCache.h = 0;
  _generationCache.variantKey = "";
  _generationCache.locked = "";
  _generationCache.hist = "";
}

function shouldGenerate(cvs: CanvasData, cc: number[], locked: boolean[], hist: number[]): boolean {
  const variantKey = galleryVariantKey(cc, locked, hist);
  const lockedStr = locked.join(",");
  const histStr = hist.join(",");
  return (
    _generationCache.data !== cvs.data ||
    _generationCache.w !== cvs.w ||
    _generationCache.h !== cvs.h ||
    _generationCache.variantKey !== variantKey ||
    _generationCache.locked !== lockedStr ||
    _generationCache.hist !== histStr
  );
}

function rememberGeneration(cvs: CanvasData, cc: number[], locked: boolean[], hist: number[]) {
  _generationCache.data = cvs.data;
  _generationCache.w = cvs.w;
  _generationCache.h = cvs.h;
  _generationCache.variantKey = galleryVariantKey(cc, locked, hist);
  _generationCache.locked = locked.join(",");
  _generationCache.hist = hist.join(",");
}

export function useGallery(cvs: CanvasData, cc: number[], locked: boolean[], hist: number[], active = true) {
  const [items, setItems] = useState<GalleryItem[]>(_cache.items);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const cancelRef = useRef(false);

  const generate = useCallback(() => {
    cancelRef.current = false;
    setGenerating(true);
    const variants = generateAllVariants(cc, locked, hist);
    const { tw, th } = calcThumbSize(cvs.w, cvs.h);
    // Initialize items without thumbnails
    const newItems: GalleryItem[] = variants.map((v) => ({ cc: v, imageData: null }));
    _cache.items = newItems;
    setItems(newItems);
    setProgress({ current: 0, total: newItems.length });

    // Generate thumbnails in chunks to avoid blocking
    let idx = 0;
    const processChunk = () => {
      if (cancelRef.current) {
        setGenerating(false);
        return;
      }
      const end = Math.min(idx + CHUNK_SIZE, newItems.length);
      for (let i = idx; i < end; i++) {
        const lut = buildColorLUT(newItems[i].cc);
        newItems[i].imageData = renderThumbnail(cvs.data, cvs.w, cvs.h, lut, tw, th);
      }
      idx = end;
      _cache.items = [...newItems];
      setItems(_cache.items);
      setProgress({ current: idx, total: newItems.length });
      if (idx < newItems.length) {
        setTimeout(processChunk, 0);
      } else {
        setGenerating(false);
      }
    };
    processChunk();
  }, [cvs, cc, locked, hist]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  // Auto-generate only while Gallery is visible; hidden generation is expensive
  // and makes controls in other tabs feel sluggish.
  useEffect(() => {
    if (!active) {
      if (generating) clearGenerationCache();
      cancel();
      return;
    }

    if (shouldGenerate(cvs, cc, locked, hist)) {
      const timeout = setTimeout(() => {
        rememberGeneration(cvs, cc, locked, hist);
        generate();
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [active, cancel, cvs, cc, locked, hist, generate, generating]);

  // Clear module-level cache on unmount to free memory
  useEffect(
    () => () => {
      cancelRef.current = true;
      _cache.items = [];
      clearGenerationCache();
    },
    [],
  );

  return { items, generating, generate, cancel, progress };
}
