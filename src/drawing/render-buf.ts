/*
 * renderCanvasBuffers — CPU-side pixel buffer renderer using putImageData.
 * NOTE: Migrating to WebGL would eliminate the putImageData bottleneck
 * by rendering directly to a GPU texture, avoiding the per-frame
 * CPU-to-canvas copy. Deferred until profiling shows this is the
 * dominant cost.
 */
import { LEVEL_INFO, LEVEL_CANDIDATES } from "../color-engine";
import { LEVEL_MASK } from "../constants";
import type { DirtyRect, ImgCache } from "../types";
import { recordDebugPerf, startDebugPerf } from "../utils/perf-debug";

/* ═══════════════════════════════════════════
   renderCanvasBuffers — module-level function
   Receives canvas elements and ImageData cache as args.
   Supports dirty-rect optimization + GRAY_VALUES LUT.
   ═══════════════════════════════════════════ */

function buildGrayValues(): Uint8Array {
  const values = new Uint8Array(8);
  for (let i = 0; i < 8; i++) values[i] = LEVEL_INFO[i].gray;
  return values;
}

export const GRAY_VALUES = buildGrayValues();

/* Pre-packed candidate RGB as 0xFFBBGGRR for fast Uint32Array writes.
   Layout: PACKED_CANDIDATES[level * MAX_VARIANTS + variantIdx] */
const MAX_VARIANTS = Math.max(...LEVEL_CANDIDATES.map((c) => c.length));
const PACKED_CANDIDATES = new Uint32Array(8 * MAX_VARIANTS);
const VARIANT_COUNTS = new Uint8Array(8);
for (let lv = 0; lv < 8; lv++) {
  const alts = LEVEL_CANDIDATES[lv];
  VARIANT_COUNTS[lv] = alts.length;
  for (let vi = 0; vi < alts.length; vi++) {
    const rgb = alts[vi].rgb;
    PACKED_CANDIDATES[lv * MAX_VARIANTS + vi] = 0xff000000 | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0];
  }
}

// Module-level LUT cache to avoid per-frame allocation
const _grayPacked = new Uint32Array(8);
for (let i = 0; i < 8; i++) {
  const g = GRAY_VALUES[i];
  _grayPacked[i] = 0xff000000 | (g << 16) | (g << 8) | g;
}
const _lutPacked = new Uint32Array(8);
let _cachedLutRef: [number, number, number][] | null = null;

export function renderCanvasBuffers(
  levelData: Uint8Array,
  w: number,
  h: number,
  lut: [number, number, number][],
  sourceCanvas: HTMLCanvasElement | null,
  previewCanvas: HTMLCanvasElement | null,
  imgCache: ImgCache,
  dirty?: DirtyRect | null,
  pixelCandidateOverrideMap?: Uint8Array | null,
): void {
  if (!sourceCanvas && !previewCanvas) return;
  const perfStart = startDebugPerf();
  const sourceContext = sourceCanvas?.getContext("2d") ?? null;
  const previewContext = previewCanvas?.getContext("2d") ?? null;
  if (!sourceContext && !previewContext) return;
  if (!imgCache.sourceImageData || imgCache.sourceImageData.width !== w || imgCache.sourceImageData.height !== h) {
    imgCache.sourceImageData = (sourceContext ?? previewContext)!.createImageData(w, h);
    imgCache.previewImageData = (previewContext ?? sourceContext)!.createImageData(w, h);
    imgCache.sourcePixels32 = new Uint32Array(imgCache.sourceImageData.data.buffer);
    imgCache.previewPixels32 = new Uint32Array(imgCache.previewImageData.data.buffer);
  }
  const sourceImageData = imgCache.sourceImageData!;
  const previewImageData = imgCache.previewImageData!;
  const sourcePixels32 = imgCache.sourcePixels32!;
  const previewPixels32 = imgCache.previewPixels32!;
  const hasPixelCandidateOverrides = pixelCandidateOverrideMap != null && pixelCandidateOverrideMap.length > 0;
  const targets = (sourceContext ? 1 : 0) + (previewContext ? 1 : 0);
  // Rebuild _lutPacked only when lut reference changes
  if (lut !== _cachedLutRef) {
    _cachedLutRef = lut;
    for (let lv = 0; lv < 8; lv++) {
      const rgb = lut[lv];
      _lutPacked[lv] = 0xff000000 | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0];
    }
  }
  if (dirty) {
    const x0 = Math.max(0, dirty.x),
      y0 = Math.max(0, dirty.y);
    const x1 = Math.min(w, dirty.x + dirty.w),
      y1 = Math.min(h, dirty.y + dirty.h);
    if (x0 >= x1 || y0 >= y1) return;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * w + x;
        const lv = levelData[i] & LEVEL_MASK;
        sourcePixels32[i] = _grayPacked[lv];
        if (hasPixelCandidateOverrides && pixelCandidateOverrideMap![i] > 0) {
          const vi = pixelCandidateOverrideMap![i] - 1;
          previewPixels32[i] = vi < VARIANT_COUNTS[lv] ? PACKED_CANDIDATES[lv * MAX_VARIANTS + vi] : _lutPacked[lv];
        } else {
          previewPixels32[i] = _lutPacked[lv];
        }
      }
    }
    const dw = x1 - x0,
      dh = y1 - y0;
    if (dw > 0 && dh > 0) {
      if (sourceContext) sourceContext.putImageData(sourceImageData, 0, 0, x0, y0, dw, dh);
      if (previewContext) previewContext.putImageData(previewImageData, 0, 0, x0, y0, dw, dh);
      recordDebugPerf("renderCanvasBuffers", perfStart, {
        mode: "dirty",
        w,
        h,
        pixels: dw * dh,
        targets,
        pixelCandidateOverrides: hasPixelCandidateOverrides,
      });
    }
  } else {
    const n = Math.min(w * h, levelData.length);
    if (!hasPixelCandidateOverrides) {
      // Fast path: no per-pixel overrides, skip variant lookup.
      for (let i = 0; i < n; i++) {
        const lv = levelData[i] & LEVEL_MASK;
        sourcePixels32[i] = _grayPacked[lv];
        previewPixels32[i] = _lutPacked[lv];
      }
    } else {
      for (let i = 0; i < n; i++) {
        const lv = levelData[i] & LEVEL_MASK;
        sourcePixels32[i] = _grayPacked[lv];
        if (pixelCandidateOverrideMap![i] > 0) {
          const vi = pixelCandidateOverrideMap![i] - 1;
          previewPixels32[i] = vi < VARIANT_COUNTS[lv] ? PACKED_CANDIDATES[lv * MAX_VARIANTS + vi] : _lutPacked[lv];
        } else {
          previewPixels32[i] = _lutPacked[lv];
        }
      }
    }
    if (sourceContext) sourceContext.putImageData(sourceImageData, 0, 0);
    if (previewContext) previewContext.putImageData(previewImageData, 0, 0);
    recordDebugPerf("renderCanvasBuffers", perfStart, {
      mode: "full",
      w,
      h,
      pixels: n,
      targets,
      pixelCandidateOverrides: hasPixelCandidateOverrides,
    });
  }
}
