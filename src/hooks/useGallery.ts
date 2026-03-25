import { useState, useCallback, useRef, useEffect } from "react";
import { LEVEL_CANDIDATES, buildColorLUT } from "../color-engine";
import { LEVEL_MASK } from "../constants";
import type { CanvasData } from "../types";

export interface GalleryItem {
  cc: number[];
  imageData: ImageData | null;
}

const THUMB_MAX = 240;
const CHUNK_SIZE = 8;

const MAX_VARIANTS = 10_000;

/** Generate all cc[] variants as a Cartesian product of unlocked candidate indices. */
export function generateAllVariants(cc: number[], locked: boolean[], hist: number[]): number[][] {
  const options: number[][] = [];
  let total = 1;
  for (let lv = 0; lv < 8; lv++) {
    const n = LEVEL_CANDIDATES[lv].length;
    if (locked[lv] || hist[lv] === 0 || n <= 1) {
      options.push([cc[lv] % n]);
    } else {
      options.push(Array.from({ length: n }, (_, i) => i));
      total *= n;
    }
  }
  // Safety: cap variant count to avoid memory explosion
  if (total > MAX_VARIANTS) {
    console.warn(`CHROMALUM: Variant count ${total} exceeds limit ${MAX_VARIANTS}, sampling randomly`);
    const results: number[][] = [];
    for (let i = 0; i < MAX_VARIANTS; i++) {
      results.push(options.map(opts => opts[Math.random() * opts.length | 0]));
    }
    return results;
  }
  // Cartesian product
  const results: number[][] = [];
  const recurse = (lv: number, current: number[]) => {
    if (lv === 8) { results.push([...current]); return; }
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
  data: Uint8Array, w: number, h: number,
  lut: [number, number, number][],
  thumbW: number, thumbH: number,
  colorMap?: Uint8Array,
): ImageData {
  const img = new ImageData(thumbW, thumbH);
  const d = img.data;
  const scaleX = w / thumbW, scaleY = h / thumbH;
  for (let ty = 0; ty < thumbH; ty++) {
    const sy = Math.min(h - 1, (ty * scaleY) | 0);
    for (let tx = 0; tx < thumbW; tx++) {
      const sx = Math.min(w - 1, (tx * scaleX) | 0);
      const srcIdx = sy * w + sx;
      const lv = data[srcIdx] & LEVEL_MASK;
      const cm = colorMap ? colorMap[srcIdx] : 0;
      const rgb = (cm > 0 && LEVEL_CANDIDATES[lv][cm - 1]) ? LEVEL_CANDIDATES[lv][cm - 1].rgb : lut[lv];
      const di = (ty * thumbW + tx) * 4;
      d[di] = rgb[0]; d[di + 1] = rgb[1]; d[di + 2] = rgb[2]; d[di + 3] = 255;
    }
  }
  return img;
}

function calcThumbSize(w: number, h: number): { tw: number; th: number } {
  const scale = Math.min(1, THUMB_MAX / Math.max(w, h));
  return { tw: Math.max(1, Math.round(w * scale)), th: Math.max(1, Math.round(h * scale)) };
}

// Cache shared across hook instances via ref-like pattern (survives tab switches)
const _cache = { items: [] as GalleryItem[] };

export function useGallery(cvs: CanvasData, cc: number[], locked: boolean[], hist: number[], showGlaze?: boolean) {
  const [items, setItems] = useState<GalleryItem[]>(_cache.items);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const cancelRef = useRef(false);

  const generate = useCallback(() => {
    cancelRef.current = false;
    setGenerating(true);
    const variants = generateAllVariants(cc, locked, hist);
    const { tw, th } = calcThumbSize(cvs.w, cvs.h);
    const cm = showGlaze ? cvs.colorMap : undefined;

    // Initialize items without thumbnails
    const newItems: GalleryItem[] = variants.map(v => ({ cc: v, imageData: null }));
    _cache.items = newItems;
    setItems(newItems);
    setProgress({ current: 0, total: newItems.length });

    // Generate thumbnails in chunks to avoid blocking
    let idx = 0;
    const processChunk = () => {
      if (cancelRef.current) { setGenerating(false); return; }
      const end = Math.min(idx + CHUNK_SIZE, newItems.length);
      for (let i = idx; i < end; i++) {
        const lut = buildColorLUT(newItems[i].cc);
        newItems[i].imageData = renderThumbnail(cvs.data, cvs.w, cvs.h, lut, tw, th, cm);
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
  }, [cvs, cc, locked, hist, showGlaze]);

  const cancel = useCallback(() => { cancelRef.current = true; }, []);

  // Clear module-level cache on unmount to free memory
  useEffect(() => () => {
    cancelRef.current = true;
    _cache.items = [];
  }, []);

  return { items, generating, generate, cancel, progress };
}
