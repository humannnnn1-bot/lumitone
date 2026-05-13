import { LEVEL_MASK } from "../constants";
import { findClosestCandidate } from "../color-engine";
import { forEachBrushPixel } from "./brush-mask";
import type { BrushMask } from "./brush-mask";

/* ═══════════════════════════════════════════
   GLAZE PAINT FUNCTIONS
   Paint per-pixel candidate override values using hue-based auto-matching.
   Geometry matches paint.ts but writes per-pixel variant.
   ═══════════════════════════════════════════ */

/** Pre-compute level→override value lookup for a given hue. Call once per stroke. */
export function buildGlazeLUT(hueAngleDeg: number): Uint8Array {
  const lut = new Uint8Array(8);
  for (let lv = 0; lv < 8; lv++) lut[lv] = findClosestCandidate(lv, hueAngleDeg) + 1;
  return lut;
}

/** Build LUT for direct candidate mode: only levels in the map get values, rest are 0 (skip). */
export function buildMultiDirectLUT(candidates: Map<number, number>): Uint8Array {
  const lut = new Uint8Array(8);
  candidates.forEach((idx, level) => {
    lut[level] = idx + 1;
  });
  return lut;
}

export function paintGlazeBrush(
  pixelCandidateOverrideMap: Uint8Array,
  levelData: Uint8Array,
  cx: number,
  cy: number,
  mask: BrushMask,
  w: number,
  h: number,
  glazeLUT: Uint8Array,
): void {
  forEachBrushPixel(mask, cx, cy, w, h, (x, y) => {
    const idx = y * w + x;
    const lv = levelData[idx] & LEVEL_MASK;
    const overrideValue = glazeLUT[lv];
    if (overrideValue === 0) return;
    pixelCandidateOverrideMap[idx] = overrideValue;
  });
}

export function paintGlazeBrushLine(
  pixelCandidateOverrideMap: Uint8Array,
  levelData: Uint8Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  mask: BrushMask,
  w: number,
  h: number,
  glazeLUT: Uint8Array,
): void {
  if (w <= 0 || h <= 0) return;
  const ax = Math.abs(x1 - x0),
    ay = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1,
    sy = y0 < y1 ? 1 : -1;
  let e = ax - ay;
  const skipDist = Math.max(1, Math.floor(mask.size / 8));
  const skipDist2 = skipDist * skipDist;
  let lastPX = x0,
    lastPY = y0;
  paintGlazeBrush(pixelCandidateOverrideMap, levelData, x0, y0, mask, w, h, glazeLUT);
  for (;;) {
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 > -ay) {
      e -= ay;
      x0 += sx;
    }
    if (e2 < ax) {
      e += ax;
      y0 += sy;
    }
    const dx = x0 - lastPX,
      dy = y0 - lastPY;
    if (dx * dx + dy * dy >= skipDist2) {
      paintGlazeBrush(pixelCandidateOverrideMap, levelData, x0, y0, mask, w, h, glazeLUT);
      lastPX = x0;
      lastPY = y0;
    }
  }
  paintGlazeBrush(pixelCandidateOverrideMap, levelData, x1, y1, mask, w, h, glazeLUT);
}

export function eraseGlazeBrush(
  pixelCandidateOverrideMap: Uint8Array,
  cx: number,
  cy: number,
  mask: BrushMask,
  w: number,
  h: number,
): void {
  forEachBrushPixel(mask, cx, cy, w, h, (x, y) => {
    pixelCandidateOverrideMap[y * w + x] = 0;
  });
}

export function eraseGlazeBrushLine(
  pixelCandidateOverrideMap: Uint8Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  mask: BrushMask,
  w: number,
  h: number,
): void {
  if (w <= 0 || h <= 0) return;
  const ax = Math.abs(x1 - x0),
    ay = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1,
    sy = y0 < y1 ? 1 : -1;
  let e = ax - ay;
  const skipDist = Math.max(1, Math.floor(mask.size / 8));
  const skipDist2 = skipDist * skipDist;
  let lastPX = x0,
    lastPY = y0;
  eraseGlazeBrush(pixelCandidateOverrideMap, x0, y0, mask, w, h);
  for (;;) {
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 > -ay) {
      e -= ay;
      x0 += sx;
    }
    if (e2 < ax) {
      e += ax;
      y0 += sy;
    }
    const dx = x0 - lastPX,
      dy = y0 - lastPY;
    if (dx * dx + dy * dy >= skipDist2) {
      eraseGlazeBrush(pixelCandidateOverrideMap, x0, y0, mask, w, h);
      lastPX = x0;
      lastPY = y0;
    }
  }
  eraseGlazeBrush(pixelCandidateOverrideMap, x1, y1, mask, w, h);
}

/** Paint a glaze circle: for each pixel, use pre-computed LUT to assign variant. */
export function paintGlazeCircle(
  pixelCandidateOverrideMap: Uint8Array,
  levelData: Uint8Array,
  cx: number,
  cy: number,
  r: number,
  w: number,
  h: number,
  glazeLUT: Uint8Array,
): void {
  const write = (x: number, y: number) => {
    if (x >= 0 && x < w && y >= 0 && y < h) {
      const idx = y * w + x;
      const lv = levelData[idx] & LEVEL_MASK;
      const overrideValue = glazeLUT[lv];
      if (overrideValue === 0) return; // direct mode: skip non-target levels
      pixelCandidateOverrideMap[idx] = overrideValue;
    }
  };
  if (r <= 0) {
    write(cx, cy);
    return;
  }
  const fillRow = (y: number, x0: number, x1: number) => {
    if (y < 0 || y >= h) return;
    const lo = Math.max(0, x0),
      hi = Math.min(w - 1, x1);
    for (let x = lo; x <= hi; x++) write(x, y);
  };
  let x = 0,
    y = r,
    d = 1 - r;
  while (x <= y) {
    fillRow(cy + y, cx - x, cx + x);
    fillRow(cy - y, cx - x, cx + x);
    if (x !== y) {
      fillRow(cy + x, cx - y, cx + y);
      fillRow(cy - x, cx - y, cx + y);
    }
    if (d < 0) d += 2 * x + 3;
    else {
      d += 2 * (x - y) + 5;
      y--;
    }
    x++;
  }
}

/** Erase glaze circle: reset per-pixel overrides to 0 (default candidateIndexByLevel[]). */
export function eraseGlazeCircle(pixelCandidateOverrideMap: Uint8Array, cx: number, cy: number, r: number, w: number, h: number): void {
  if (r <= 0) {
    if (cx >= 0 && cx < w && cy >= 0 && cy < h) pixelCandidateOverrideMap[cy * w + cx] = 0;
    return;
  }
  const fillRow = (y: number, x0: number, x1: number) => {
    if (y < 0 || y >= h) return;
    const lo = Math.max(0, x0),
      hi = Math.min(w - 1, x1);
    for (let x = lo; x <= hi; x++) pixelCandidateOverrideMap[y * w + x] = 0;
  };
  let x = 0,
    y = r,
    d = 1 - r;
  while (x <= y) {
    fillRow(cy + y, cx - x, cx + x);
    fillRow(cy - y, cx - x, cx + x);
    if (x !== y) {
      fillRow(cy + x, cx - y, cx + y);
      fillRow(cy - x, cx - y, cx + y);
    }
    if (d < 0) d += 2 * x + 3;
    else {
      d += 2 * (x - y) + 5;
      y--;
    }
    x++;
  }
}
