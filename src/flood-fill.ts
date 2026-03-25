/* ═══════════════════════════════════════════
   FLOOD FILL
   Scanline FloodFill — flat Int32Array stack (reduced GC pressure).
   Returns changed indices + truncation flag.
   ═══════════════════════════════════════════ */

import { LEVEL_MASK } from "./constants";

export interface FloodFillResult {
  changed: Uint32Array;
  truncated: boolean;
}

/**
 * Generic scanline flood fill engine.
 * Delegates pixel matching and writing to caller-provided callbacks,
 * keeping the stack management and scanline iteration in one place.
 */
function scanlineFill(
  sx: number, sy: number, w: number, h: number,
  match: (idx: number) => boolean,
  write: (idx: number) => boolean,
): FloodFillResult | null {
  if (sx < 0 || sx >= w || sy < 0 || sy >= h) return null;
  if (!match(sy * w + sx)) return null;

  const maxPixels = w * h;
  /* Stack initial size: use sqrt(maxPixels) * 4 as a better heuristic
     to reduce re-allocations while keeping initial memory reasonable.
     Cap growth at maxPixels * 4 (absolute worst case). */
  const initStackSize = Math.min(Math.max(1024, (Math.sqrt(maxPixels) | 0) * 4), maxPixels * 4);
  let stack = new Int32Array(initStackSize);
  let sp = 0;
  const initChangedSize = Math.min(Math.max(256, Math.sqrt(maxPixels) | 0), maxPixels);
  let changed = new Uint32Array(initChangedSize);
  let ci = 0;
  let truncated = false;

  const pushChanged = (idx: number) => {
    if (ci >= changed.length) {
      const newLen = Math.min(changed.length * 2, maxPixels);
      if (newLen <= changed.length) { truncated = true; return; }
      const nc = new Uint32Array(newLen); nc.set(changed); changed = nc;
    }
    changed[ci++] = idx;
  };

  const push = (y: number, xl: number, xr: number, dy: number) => {
    if (sp + 4 > stack.length) {
      const newLen = Math.min(stack.length * 2, maxPixels * 4);
      if (newLen <= stack.length) { truncated = true; return; }
      const ns = new Int32Array(newLen);
      ns.set(stack); stack = ns;
    }
    stack[sp++] = y; stack[sp++] = xl; stack[sp++] = xr; stack[sp++] = dy;
  };

  push(sy, sx, sx, 1);
  push(sy - 1, sx, sx, -1);

  while (sp > 0) {
    const dy = stack[--sp], xr = stack[--sp], xl = stack[--sp], y = stack[--sp];
    if (y < 0 || y >= h) continue;
    let x = xl;
    while (x >= 0 && match(y * w + x)) { const idx = y * w + x; if (write(idx)) pushChanged(idx); x--; }
    const lx = x + 1;
    x = xl + 1;
    while (x < w && match(y * w + x)) { const idx = y * w + x; if (write(idx)) pushChanged(idx); x++; }
    const rx = x - 1;
    const ny = y + dy;
    if (ny >= 0 && ny < h) {
      let a = false;
      for (let i = lx; i <= rx; i++) {
        if (match(ny * w + i)) { if (!a) { push(ny, i, i, dy); a = true; } } else a = false;
      }
    }
    const oy = y - dy;
    if (oy >= 0 && oy < h) {
      let a = false;
      for (let i = lx; i < xl; i++) {
        if (match(oy * w + i)) { if (!a) { push(oy, i, i, -dy); a = true; } } else a = false;
      }
      a = false;
      for (let i = xr + 1; i <= rx; i++) {
        if (match(oy * w + i)) { if (!a) { push(oy, i, i, -dy); a = true; } } else a = false;
      }
    }
  }
  return { changed: changed.subarray(0, ci), truncated };
}

export function floodFill(data: Uint8Array, sx: number, sy: number, newVal: number, w: number, h: number): FloodFillResult | null {
  const oldVal = data[sy * w + sx];
  if (oldVal === newVal) return null;
  return scanlineFill(sx, sy, w, h,
    (idx) => data[idx] === oldVal,
    (idx) => { data[idx] = newVal; return true; },
  );
}

/** Reusable visited buffer for glaze flood fill (avoids allocation per fill). */
let _visitedBuf: Uint8Array | null = null;

/** Glaze flood fill: uses data[] level connectivity, writes to colorMap[]. */
export function glazeFloodFill(
  data: Uint8Array, colorMap: Uint8Array,
  sx: number, sy: number, newCmVal: number,
  w: number, h: number,
): FloodFillResult | null {
  if (sx < 0 || sx >= w || sy < 0 || sy >= h) return null;
  const seedIdx = sy * w + sx;
  const seedLevel = data[seedIdx] & LEVEL_MASK;
  const n = w * h;
  if (!_visitedBuf || _visitedBuf.length < n) {
    _visitedBuf = new Uint8Array(n);
  } else {
    _visitedBuf.fill(0, 0, n);
  }
  const visited = _visitedBuf;
  return scanlineFill(sx, sy, w, h,
    (idx) => !visited[idx] && (data[idx] & LEVEL_MASK) === seedLevel,
    (idx) => { visited[idx] = 1; if (colorMap[idx] === newCmVal) return false; colorMap[idx] = newCmVal; return true; },
  );
}
