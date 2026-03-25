import { LEVEL_MASK } from "../constants";

/* ═══════════════════════════════════════════
   PIXEL ANALYSIS — pure functions (no React dependency)
   ═══════════════════════════════════════════ */

/** Visual identity key: combines level + glaze variant into a single comparison value. */
function vizKey(data: Uint8Array, colorMap: Uint8Array | undefined, i: number): number {
  const lv = data[i] & LEVEL_MASK;
  return colorMap ? (lv << 8) | colorMap[i] : lv;
}

export function computeNoiseLevelNorm(data: Uint8Array, w: number, h: number, noise: Float32Array, levelNorm: Float32Array, colorMap?: Uint8Array) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, pix = vizKey(data, colorMap, i);
      levelNorm[i] = (data[i] & LEVEL_MASK) / 7;
      let diff = 0;
      if (x > 0 && vizKey(data, colorMap, i - 1) !== pix) diff++;
      if (x + 1 < w && vizKey(data, colorMap, i + 1) !== pix) diff++;
      if (y > 0 && vizKey(data, colorMap, i - w) !== pix) diff++;
      if (y + 1 < h && vizKey(data, colorMap, i + w) !== pix) diff++;
      noise[i] = diff / 4;
    }
  }
}

export function computeDiversity(data: Uint8Array, w: number, h: number, localDiversity: Float32Array, colorMap?: Uint8Array) {
  const R = 2;
  // Reuse a single Map across all pixels to avoid per-pixel allocation
  const seen = new Map<number, true>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const y0 = Math.max(0, y - R), y1 = Math.min(h - 1, y + R);
      const x0 = Math.max(0, x - R), x1 = Math.min(w - 1, x + R);
      seen.clear();
      for (let ny = y0; ny <= y1; ny++) for (let nx = x0; nx <= x1; nx++) seen.set(vizKey(data, colorMap, ny * w + nx), true);
      // Normalize: max possible is 8 levels × many variants, but cap at reasonable range
      const maxKeys = colorMap ? Math.max(8, seen.size) : 8;
      localDiversity[y * w + x] = Math.min(1, (seen.size - 1) / (maxKeys - 1 || 1));
    }
  }
}

export function computeEdgeDepth(data: Uint8Array, w: number, h: number, isEdge: Uint8Array, depth: Float32Array, colorMap?: Uint8Array) {
  const n = w * h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, pix = vizKey(data, colorMap, i);
      if ((x + 1 < w && vizKey(data, colorMap, i + 1) !== pix) || (y + 1 < h && vizKey(data, colorMap, i + w) !== pix) ||
          (x > 0 && vizKey(data, colorMap, i - 1) !== pix) || (y > 0 && vizKey(data, colorMap, i - w) !== pix)) isEdge[i] = 1;
    }
  }
  const queue = new Int32Array(n);
  let head = 0, tail = 0;
  for (let i = 0; i < n; i++) { if (isEdge[i]) { depth[i] = 0; queue[tail++] = i; } else depth[i] = -1; }
  while (head < tail) {
    const idx = queue[head++], x = idx % w, y = (idx / w) | 0, nd = depth[idx] + 1;
    const neighbors = [y > 0 ? idx - w : -1, y + 1 < h ? idx + w : -1, x > 0 ? idx - 1 : -1, x + 1 < w ? idx + 1 : -1];
    for (const ni of neighbors) { if (ni >= 0 && depth[ni] < 0) { depth[ni] = nd; queue[tail++] = ni; } }
  }
  let maxD = 1;
  for (let i = 0; i < n; i++) { if (depth[i] > maxD) maxD = depth[i]; }
  for (let i = 0; i < n; i++) depth[i] = Math.max(0, depth[i]) / maxD;
}

export function computeGradient(data: Uint8Array, w: number, h: number, levelNorm: Float32Array, gradAngle: Float32Array, gradMag: Float32Array) {
  const n = w * h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const l = x > 0 ? (data[i - 1] & LEVEL_MASK) : (data[i] & LEVEL_MASK);
      const r2 = x + 1 < w ? (data[i + 1] & LEVEL_MASK) : (data[i] & LEVEL_MASK);
      const u = y > 0 ? (data[i - w] & LEVEL_MASK) : (data[i] & LEVEL_MASK);
      const d2 = y + 1 < h ? (data[i + w] & LEVEL_MASK) : (data[i] & LEVEL_MASK);
      const gx = r2 - l, gy = d2 - u;
      gradMag[i] = Math.sqrt(gx * gx + gy * gy);
      gradAngle[i] = Math.atan2(gy, gx);
    }
  }
  let maxGM = 1;
  for (let i = 0; i < n; i++) { if (gradMag[i] > maxGM) maxGM = gradMag[i]; }
  for (let i = 0; i < n; i++) gradMag[i] /= maxGM;
  // Populate levelNorm if not already done (needed for gradient dim background)
  if (levelNorm[0] === 0 && n > 0 && (data[0] & LEVEL_MASK) !== 0) {
    for (let i = 0; i < n; i++) levelNorm[i] = (data[i] & LEVEL_MASK) / 7;
  }
}

export function computeRegion(data: Uint8Array, w: number, h: number, regionId: Int32Array, isEdge: Uint8Array, colorMap?: Uint8Array) {
  const n = w * h;
  // Edge detection (needed for region borders)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, pix = vizKey(data, colorMap, i);
      if ((x + 1 < w && vizKey(data, colorMap, i + 1) !== pix) || (y + 1 < h && vizKey(data, colorMap, i + w) !== pix) ||
          (x > 0 && vizKey(data, colorMap, i - 1) !== pix) || (y > 0 && vizKey(data, colorMap, i - w) !== pix)) isEdge[i] = 1;
    }
  }
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  function find(x: number): number { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  function unite(a: number, b: number) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, pix = vizKey(data, colorMap, i);
      if (x + 1 < w && vizKey(data, colorMap, i + 1) === pix) unite(i, i + 1);
      if (y + 1 < h && vizKey(data, colorMap, i + w) === pix) unite(i, i + w);
    }
  }
  for (let i = 0; i < n; i++) regionId[i] = find(i);
}
