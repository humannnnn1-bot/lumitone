/*
 * renderBuf — CPU-side pixel buffer renderer using putImageData.
 * NOTE: Migrating to WebGL would eliminate the putImageData bottleneck
 * by rendering directly to a GPU texture, avoiding the per-frame
 * CPU-to-canvas copy. Deferred until profiling shows this is the
 * dominant cost.
 */
import { LEVEL_INFO, LEVEL_CANDIDATES } from "./color-engine";
import { LEVEL_MASK } from "./constants";
import type { DirtyRect, ImgCache } from "./types";

/* ═══════════════════════════════════════════
   renderBuf — module-level function
   Receives canvas elements and ImageData cache as args.
   Supports dirty-rect optimization + GRAY_VALUES LUT.
   ═══════════════════════════════════════════ */

export const GRAY_VALUES = new Uint8Array(8);
for (let i = 0; i < 8; i++) GRAY_VALUES[i] = LEVEL_INFO[i].gray;

/* Pre-packed candidate RGB as 0xFFBBGGRR for fast Uint32Array writes.
   Layout: PACKED_CANDIDATES[level * MAX_VARIANTS + variantIdx] */
const MAX_VARIANTS = Math.max(...LEVEL_CANDIDATES.map(c => c.length));
const PACKED_CANDIDATES = new Uint32Array(8 * MAX_VARIANTS);
const VARIANT_COUNTS = new Uint8Array(8);
for (let lv = 0; lv < 8; lv++) {
  const alts = LEVEL_CANDIDATES[lv];
  VARIANT_COUNTS[lv] = alts.length;
  for (let vi = 0; vi < alts.length; vi++) {
    const rgb = alts[vi].rgb;
    PACKED_CANDIDATES[lv * MAX_VARIANTS + vi] = 0xFF000000 | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0];
  }
}

// Module-level LUT cache to avoid per-frame allocation
const _grayPacked = new Uint32Array(8);
for (let i = 0; i < 8; i++) {
  const g = GRAY_VALUES[i];
  _grayPacked[i] = 0xFF000000 | (g << 16) | (g << 8) | g;
}
const _lutPacked = new Uint32Array(8);
let _cachedLutRef: [number, number, number][] | null = null;

export function renderBuf(
  data: Uint8Array, w: number, h: number,
  lut: [number, number, number][],
  srcCanvas: HTMLCanvasElement | null,
  prvCanvas: HTMLCanvasElement | null,
  imgCache: ImgCache,
  dirty?: DirtyRect | null,
  colorMap?: Uint8Array | null,
): void {
  if (!srcCanvas && !prvCanvas) return;
  const sc = srcCanvas?.getContext("2d") ?? null;
  const pc = prvCanvas?.getContext("2d") ?? null;
  if (!sc && !pc) return;
  if (!imgCache.src || imgCache.src.width !== w || imgCache.src.height !== h) {
    imgCache.src = (sc ?? pc)!.createImageData(w, h);
    imgCache.prv = (pc ?? sc)!.createImageData(w, h);
    imgCache.s32 = new Uint32Array(imgCache.src.data.buffer);
    imgCache.p32 = new Uint32Array(imgCache.prv.data.buffer);
  }
  const si = imgCache.src!, pi = imgCache.prv!;
  const s32 = imgCache.s32!, p32 = imgCache.p32!;
  const hasColorMap = colorMap != null && colorMap.length > 0;
  // Rebuild _lutPacked only when lut reference changes
  if (lut !== _cachedLutRef) {
    _cachedLutRef = lut;
    for (let lv = 0; lv < 8; lv++) {
      const rgb = lut[lv];
      _lutPacked[lv] = 0xFF000000 | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0];
    }
  }
  if (dirty) {
    const x0 = Math.max(0, dirty.x), y0 = Math.max(0, dirty.y);
    const x1 = Math.min(w, dirty.x + dirty.w), y1 = Math.min(h, dirty.y + dirty.h);
    if (x0 >= x1 || y0 >= y1) return;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * w + x;
        const lv = data[i] & LEVEL_MASK;
        s32[i] = _grayPacked[lv];
        if (hasColorMap && colorMap![i] > 0) {
          const vi = colorMap![i] - 1;
          p32[i] = vi < VARIANT_COUNTS[lv] ? PACKED_CANDIDATES[lv * MAX_VARIANTS + vi] : _lutPacked[lv];
        } else {
          p32[i] = _lutPacked[lv];
        }
      }
    }
    const dw = x1 - x0, dh = y1 - y0;
    if (dw > 0 && dh > 0) {
      if (sc) sc.putImageData(si, 0, 0, x0, y0, dw, dh);
      if (pc) pc.putImageData(pi, 0, 0, x0, y0, dw, dh);
    }
  } else {
    const n = Math.min(w * h, data.length);
    if (!hasColorMap) {
      // Fast path: no colorMap, skip per-pixel variant check
      for (let i = 0; i < n; i++) {
        const lv = data[i] & LEVEL_MASK;
        s32[i] = _grayPacked[lv];
        p32[i] = _lutPacked[lv];
      }
    } else {
      for (let i = 0; i < n; i++) {
        const lv = data[i] & LEVEL_MASK;
        s32[i] = _grayPacked[lv];
        if (colorMap![i] > 0) {
          const vi = colorMap![i] - 1;
          p32[i] = vi < VARIANT_COUNTS[lv] ? PACKED_CANDIDATES[lv * MAX_VARIANTS + vi] : _lutPacked[lv];
        } else {
          p32[i] = _lutPacked[lv];
        }
      }
    }
    if (sc) sc.putImageData(si, 0, 0);
    if (pc) pc.putImageData(pi, 0, 0);
  }
}

