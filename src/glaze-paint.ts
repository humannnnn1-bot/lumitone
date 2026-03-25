import { LEVEL_MASK } from "./constants";
import { findClosestCandidate } from "./color-engine";

/* ═══════════════════════════════════════════
   GLAZE PAINT FUNCTIONS
   Paint to colorMap[] using hue-based auto-matching.
   Geometry matches paint.ts but writes per-pixel variant.
   ═══════════════════════════════════════════ */

/** Pre-compute level→cmVal lookup for a given hue. Call once per stroke. */
export function buildGlazeLUT(hueAngle: number): Uint8Array {
  const lut = new Uint8Array(8);
  for (let lv = 0; lv < 8; lv++) lut[lv] = findClosestCandidate(lv, hueAngle) + 1;
  return lut;
}

/** Build LUT for direct candidate mode: only levels in the map get values, rest are 0 (skip). */
export function buildMultiDirectLUT(candidates: Map<number, number>): Uint8Array {
  const lut = new Uint8Array(8);
  candidates.forEach((idx, level) => { lut[level] = idx + 1; });
  return lut;
}

/** Paint a glaze circle: for each pixel, use pre-computed LUT to assign variant. */
export function paintGlazeCircle(
  colorMap: Uint8Array, data: Uint8Array,
  cx: number, cy: number, r: number,
  w: number, h: number,
  glazeLUT: Uint8Array,
): void {
  const write = (x: number, y: number) => {
    if (x >= 0 && x < w && y >= 0 && y < h) {
      const idx = y * w + x;
      const lv = data[idx] & LEVEL_MASK;
      const cmVal = glazeLUT[lv];
      if (cmVal === 0) return; // direct mode: skip non-target levels
      colorMap[idx] = cmVal;
    }
  };
  if (r <= 0) { write(cx, cy); return; }
  const fillRow = (y: number, x0: number, x1: number) => {
    if (y < 0 || y >= h) return;
    const lo = Math.max(0, x0), hi = Math.min(w - 1, x1);
    for (let x = lo; x <= hi; x++) write(x, y);
  };
  let x = 0, y = r, d = 1 - r;
  while (x <= y) {
    fillRow(cy + y, cx - x, cx + x);
    fillRow(cy - y, cx - x, cx + x);
    if (x !== y) { fillRow(cy + x, cx - y, cx + y); fillRow(cy - x, cx - y, cx + y); }
    if (d < 0) d += 2 * x + 3; else { d += 2 * (x - y) + 5; y--; }
    x++;
  }
}

/** Paint a glaze line with circular brush at each step. */
export function paintGlazeLine(
  colorMap: Uint8Array, data: Uint8Array,
  x0: number, y0: number, x1: number, y1: number,
  r: number, w: number, h: number,
  glazeLUT: Uint8Array,
): void {
  if (w <= 0 || h <= 0) return;
  const ax = Math.abs(x1 - x0), ay = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = ax - ay;
  for (;;) {
    paintGlazeCircle(colorMap, data, x0, y0, r, w, h, glazeLUT);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 > -ay) { e -= ay; x0 += sx; }
    if (e2 < ax) { e += ax; y0 += sy; }
  }
}

/** Erase glaze circle: reset colorMap to 0 (default cc[]). */
export function eraseGlazeCircle(
  colorMap: Uint8Array,
  cx: number, cy: number, r: number,
  w: number, h: number,
): void {
  if (r <= 0) {
    if (cx >= 0 && cx < w && cy >= 0 && cy < h) colorMap[cy * w + cx] = 0;
    return;
  }
  const fillRow = (y: number, x0: number, x1: number) => {
    if (y < 0 || y >= h) return;
    const lo = Math.max(0, x0), hi = Math.min(w - 1, x1);
    for (let x = lo; x <= hi; x++) colorMap[y * w + x] = 0;
  };
  let x = 0, y = r, d = 1 - r;
  while (x <= y) {
    fillRow(cy + y, cx - x, cx + x);
    fillRow(cy - y, cx - x, cx + x);
    if (x !== y) { fillRow(cy + x, cx - y, cx + y); fillRow(cy - x, cx - y, cx + y); }
    if (d < 0) d += 2 * x + 3; else { d += 2 * (x - y) + 5; y--; }
    x++;
  }
}

/** Erase glaze line with circular eraser at each step. */
export function eraseGlazeLine(
  colorMap: Uint8Array,
  x0: number, y0: number, x1: number, y1: number,
  r: number, w: number, h: number,
): void {
  if (w <= 0 || h <= 0) return;
  const ax = Math.abs(x1 - x0), ay = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = ax - ay;
  for (;;) {
    eraseGlazeCircle(colorMap, x0, y0, r, w, h);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 > -ay) { e -= ay; x0 += sx; }
    if (e2 < ax) { e += ax; y0 += sy; }
  }
}
