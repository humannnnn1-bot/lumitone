import { LEVEL_CANDIDATES, LEVEL_INFO, LUMA_B, LUMA_G, LUMA_R } from "../color-engine";
import { LEVEL_MASK } from "../constants";
import type { CanvasData, MapMode } from "../types";
import { hexStr } from "../utils";
import type { StatusText } from "../utils/status-display";

export interface AnalysisPixelMaps {
  noise: Float32Array;
  depth: Float32Array;
  gradAngle: Float32Array;
  gradMag: Float32Array;
  regionId: Int32Array;
  isEdge: Uint8Array;
  levelNorm: Float32Array;
  localDiversity: Float32Array;
  w: number;
  h: number;
}

export type AnalysisColorLUT = [number, number, number][];
export type AnalysisMapRenderStatus = "rendered" | "stale";

const REGION_SMALL_THRESHOLD = 10;
const MAP_STATUS_LABEL: Record<MapMode, string> = {
  luminance: "MapLuma",
  colorlum: "MapColorLum",
  region: "MapRegion",
  gradient: "MapGrad",
  depth: "MapDepth",
  noise: "MapIso",
  entropy: "MapDiv",
};

function buildLUT(stops: [number, number, number][]): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  const n = stops.length - 1;
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * n;
    const idx = Math.min(n - 1, t | 0);
    const f = t - idx;
    const a = stops[idx],
      b = stops[idx + 1];
    lut[i * 3] = (a[0] + (b[0] - a[0]) * f) | 0;
    lut[i * 3 + 1] = (a[1] + (b[1] - a[1]) * f) | 0;
    lut[i * 3 + 2] = (a[2] + (b[2] - a[2]) * f) | 0;
  }
  return lut;
}

function packRgb(r: number, g: number, b: number): number {
  return 0xff000000 | (b << 16) | (g << 8) | r;
}

function applyLUTPacked(lut: Uint8Array, v: number): number {
  const i = Math.max(0, Math.min(255, (v * 255) | 0)) * 3;
  return packRgb(lut[i], lut[i + 1], lut[i + 2]);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

function pct(v: number): string {
  return `${Math.round(clamp01(v) * 100)}%`;
}

function shortCount(n: number): string {
  const count = Math.max(0, Math.round(n));
  if (count >= 1_000_000) return `${Math.round(count / 100_000) / 10}M`;
  if (count >= 10_000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${Math.round(count / 100) / 10}k`;
  return String(count);
}

function valueAt<T extends Float32Array | Int32Array | Uint8Array>(arr: T, idx: number, fallback = 0): number {
  const v = arr[idx];
  return Number.isFinite(v) ? v : fallback;
}

function signedInt(v: number): string {
  if (v === 0) return "0";
  return `${v > 0 ? "+" : ""}${v}`;
}

function normalizeCandidateIndex(lv: number, idx: number): number {
  const count = LEVEL_CANDIDATES[lv]?.length ?? 1;
  return count > 0 ? ((idx % count) + count) % count : 0;
}

function resolveCandidate(lv: number, idx: number): { ci: number; count: number; rgb: [number, number, number] } {
  const alts = LEVEL_CANDIDATES[lv] ?? LEVEL_CANDIDATES[0];
  const ci = normalizeCandidateIndex(lv, idx);
  return {
    ci,
    count: alts.length,
    rgb: alts[ci]?.rgb ?? alts[0].rgb,
  };
}

function candidateLabel(candidate: { ci: number; count: number }): string {
  return `c${candidate.ci + 1}/${candidate.count}`;
}

function visualKey(cvs: CanvasData, idx: number): number {
  return ((cvs.data[idx] & LEVEL_MASK) << 8) | (cvs.colorMap[idx] ?? 0);
}

function visualLabel(cvs: CanvasData, cc: number[], idx: number, lv: number): string {
  const cm = cvs.colorMap[idx] ?? 0;
  const candidate = cm > 0 ? resolveCandidate(lv, cm - 1) : resolveCandidate(lv, cc[lv] ?? 0);
  return `${cm > 0 ? "override" : "base"} ${candidateLabel(candidate)} ${hexStr(candidate.rgb)}`;
}

function compactVisualLabel(cvs: CanvasData, cc: number[], idx: number, lv: number): string {
  const cm = cvs.colorMap[idx] ?? 0;
  const candidate = cm > 0 ? resolveCandidate(lv, cm - 1) : resolveCandidate(lv, cc[lv] ?? 0);
  return `${cm > 0 ? "ovr" : "base"} ${candidateLabel(candidate)}`;
}

function luma255(rgb: [number, number, number]): number {
  return Math.round(LUMA_R * rgb[0] + LUMA_G * rgb[1] + LUMA_B * rgb[2]);
}

function gradientVector(cvs: CanvasData, x: number, y: number): { gx: number; gy: number } {
  const { data, w, h } = cvs;
  const idx = y * w + x;
  const center = data[idx] & LEVEL_MASK;
  const l = x > 0 ? data[idx - 1] & LEVEL_MASK : center;
  const r = x + 1 < w ? data[idx + 1] & LEVEL_MASK : center;
  const u = y > 0 ? data[idx - w] & LEVEL_MASK : center;
  const d = y + 1 < h ? data[idx + w] & LEVEL_MASK : center;
  return { gx: r - l, gy: d - u };
}

function diversityWindowInfo(cvs: CanvasData, x: number, y: number): { keys: number; winW: number; winH: number } {
  const seen = new Set<number>();
  const x0 = Math.max(0, x - 2);
  const x1 = Math.min(cvs.w - 1, x + 2);
  const y0 = Math.max(0, y - 2);
  const y1 = Math.min(cvs.h - 1, y + 2);
  for (let ny = y0; ny <= y1; ny++) {
    for (let nx = x0; nx <= x1; nx++) {
      seen.add(visualKey(cvs, ny * cvs.w + nx));
    }
  }
  return { keys: seen.size, winW: x1 - x0 + 1, winH: y1 - y0 + 1 };
}

function hslPacked(hue: number, sat: number, lit: number): number {
  const c = (1 - Math.abs(2 * lit - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lit - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return packRgb((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

const VIRIDIS = buildLUT([
  [68, 1, 84],
  [72, 20, 103],
  [72, 38, 119],
  [67, 56, 131],
  [59, 72, 138],
  [48, 87, 140],
  [39, 100, 141],
  [31, 113, 141],
  [24, 125, 139],
  [19, 137, 135],
  [15, 149, 130],
  [23, 160, 121],
  [50, 171, 109],
  [82, 180, 92],
  [119, 189, 69],
  [160, 196, 43],
  [202, 201, 31],
  [246, 207, 35],
  [253, 231, 37],
]);

const MAGMA = buildLUT([
  [0, 0, 4],
  [10, 7, 34],
  [30, 12, 69],
  [56, 15, 100],
  [81, 18, 124],
  [106, 21, 141],
  [132, 26, 148],
  [156, 39, 146],
  [179, 56, 137],
  [199, 78, 123],
  [215, 103, 109],
  [228, 130, 95],
  [239, 159, 84],
  [247, 189, 83],
  [251, 218, 95],
  [252, 244, 130],
  [252, 253, 191],
]);

const INFERNO = buildLUT([
  [0, 0, 4],
  [11, 7, 36],
  [35, 10, 73],
  [64, 10, 103],
  [90, 12, 122],
  [116, 16, 130],
  [142, 22, 128],
  [166, 36, 118],
  [187, 55, 103],
  [205, 79, 84],
  [219, 106, 63],
  [230, 134, 42],
  [238, 165, 26],
  [242, 196, 22],
  [243, 228, 40],
  [245, 253, 105],
  [252, 255, 164],
]);

const TURBO = buildLUT([
  [48, 18, 59],
  [61, 55, 137],
  [65, 95, 190],
  [56, 133, 217],
  [40, 168, 222],
  [33, 196, 206],
  [42, 218, 171],
  [72, 233, 131],
  [114, 242, 90],
  [163, 245, 57],
  [210, 240, 37],
  [247, 225, 34],
  [254, 198, 40],
  [249, 163, 42],
  [234, 126, 39],
  [212, 89, 31],
  [182, 55, 22],
  [144, 28, 14],
  [122, 4, 3],
]);

export function rasterizeAnalysisMap({
  mode,
  pixelMaps,
  colorLUT,
  cvs,
  target,
  regionSizeById,
}: {
  mode: MapMode;
  pixelMaps: AnalysisPixelMaps;
  colorLUT: AnalysisColorLUT;
  cvs: CanvasData;
  target: Uint32Array;
  regionSizeById?: Map<number, number>;
}): AnalysisMapRenderStatus {
  const w = cvs.w;
  const h = cvs.h;
  const n = w * h;
  target.fill(0);

  if (pixelMaps.w !== w || pixelMaps.h !== h) return "stale";

  if (mode === "entropy" && pixelMaps.localDiversity.length >= n) {
    for (let i = 0; i < n; i++) {
      target[i] = applyLUTPacked(VIRIDIS, pixelMaps.localDiversity[i]);
    }
  } else if (mode === "noise" && pixelMaps.noise.length >= n) {
    for (let i = 0; i < n; i++) {
      const v = pixelMaps.noise[i];
      target[i] = applyLUTPacked(INFERNO, v * v);
    }
  } else if (mode === "depth" && pixelMaps.depth.length >= n) {
    for (let i = 0; i < n; i++) {
      target[i] = applyLUTPacked(TURBO, 1 - pixelMaps.depth[i]);
    }
  } else if (mode === "luminance" && pixelMaps.levelNorm.length >= n) {
    for (let i = 0; i < n; i++) {
      target[i] = applyLUTPacked(MAGMA, pixelMaps.levelNorm[i]);
    }
  } else if (mode === "colorlum") {
    for (let i = 0; i < n; i++) {
      const lv = cvs.data[i] & LEVEL_MASK;
      const rgb = colorLUT[lv];
      const lumVal = (LUMA_R * rgb[0] + LUMA_G * rgb[1] + LUMA_B * rgb[2]) / 255;
      target[i] = applyLUTPacked(INFERNO, lumVal);
    }
  } else if (mode === "gradient" && pixelMaps.gradMag.length >= n && pixelMaps.levelNorm.length >= n) {
    for (let i = 0; i < n; i++) {
      const mag = pixelMaps.gradMag[i];
      if (mag < 0.01) {
        const g = (pixelMaps.levelNorm[i] * 30 + 8) | 0;
        target[i] = packRgb(g, g, g);
        continue;
      }
      const hue = ((pixelMaps.gradAngle[i] + Math.PI) / (2 * Math.PI)) * 360;
      target[i] = hslPacked(hue, 0.7 + mag * 0.3, 0.15 + mag * 0.4);
    }
  } else if (mode === "region" && pixelMaps.regionId.length >= n && pixelMaps.isEdge.length >= n) {
    const phi = 0.618033988749895;
    const regionSize = regionSizeById ?? buildRegionSizeMap(pixelMaps);
    for (let i = 0; i < n; i++) {
      if (pixelMaps.isEdge[i]) {
        target[i] = 0xff000000;
        continue;
      }
      const id = pixelMaps.regionId[i];
      const size = regionSize.get(id) || 0;
      if (size < REGION_SMALL_THRESHOLD) {
        const t = 1 - size / REGION_SMALL_THRESHOLD;
        const v = (t * 100) | 0;
        target[i] = 0xff000000 | (v << 16) | (v << 8) | 255;
        continue;
      }
      const hue = ((id * phi) % 1) * 360;
      const sat = 0.6 + ((id * 0.1337) % 1) * 0.4;
      const lit = 0.35 + ((id * 0.7919) % 1) * 0.3;
      target[i] = hslPacked(hue, sat, lit);
    }
  }

  return "rendered";
}

export function buildRegionSizeMap(pixelMaps: Pick<AnalysisPixelMaps, "regionId" | "w" | "h">): Map<number, number> {
  const sizes = new Map<number, number>();
  for (let i = 0; i < pixelMaps.w * pixelMaps.h; i++) {
    const id = pixelMaps.regionId[i];
    sizes.set(id, (sizes.get(id) || 0) + 1);
  }
  return sizes;
}

export function getAnalysisMapHoverInfo({
  x,
  y,
  mode,
  pixelMaps,
  colorLUT,
  cc,
  cvs,
  regionSizeById,
}: {
  x: number;
  y: number;
  mode: MapMode;
  pixelMaps: AnalysisPixelMaps;
  colorLUT: AnalysisColorLUT;
  cc: number[];
  cvs: CanvasData;
  regionSizeById: Map<number, number>;
}): StatusText | null {
  const w = cvs.w;
  const h = cvs.h;
  if (x < 0 || x >= w || y < 0 || y >= h) return null;

  const idx = y * w + x;
  const lv = cvs.data[idx] & LEVEL_MASK;
  const prefix = `(${x},${y}) ${MAP_STATUS_LABEL[mode]} L${lv}`;
  const compactPrefix = `(${x},${y}) ${MAP_STATUS_LABEL[mode].replace("Map", "")} L${lv}`;
  const needsComputedMap = mode !== "luminance" && mode !== "colorlum";
  if (needsComputedMap && (pixelMaps.w !== w || pixelMaps.h !== h))
    return { full: `${prefix} pending`, compact: `${compactPrefix} pending` };

  if (mode === "entropy") {
    const { keys, winW, winH } = diversityWindowInfo(cvs, x, y);
    const score = valueAt(pixelMaps.localDiversity, idx);
    return {
      full: `${prefix} ${visualLabel(cvs, cc, idx, lv)} win=${winW}x${winH} keys=${keys} score=${pct(score)}`,
      compact: `${compactPrefix} ${compactVisualLabel(cvs, cc, idx, lv)} keys=${keys} score=${pct(score)}`,
    };
  } else if (mode === "gradient") {
    const mag = valueAt(pixelMaps.gradMag, idx);
    const deg = Math.round((((valueAt(pixelMaps.gradAngle, idx) + Math.PI) / (2 * Math.PI)) * 360 + 360) % 360);
    const { gx, gy } = gradientVector(cvs, x, y);
    return {
      full: `${prefix} g=(${signedInt(gx)},${signedInt(gy)}) dir=${deg}\u00B0 mag=${pct(mag)} ${mag < 0.01 ? "flat" : "slope"}`,
      compact: `${compactPrefix} g=(${signedInt(gx)},${signedInt(gy)}) ${deg}\u00B0 ${pct(mag)}`,
    };
  } else if (mode === "depth") {
    const raw = valueAt(pixelMaps.depth, idx);
    const isEdge = valueAt(pixelMaps.isEdge, idx) > 0;
    const zone = isEdge ? "edge" : raw < 0.5 ? "near" : "core";
    return {
      full: `${prefix} ${visualLabel(cvs, cc, idx, lv)} depth=${pct(raw)} ${zone}`,
      compact: `${compactPrefix} ${compactVisualLabel(cvs, cc, idx, lv)} d=${pct(raw)} ${zone}`,
    };
  } else if (mode === "noise") {
    const score = valueAt(pixelMaps.noise, idx);
    const unlike = Math.round(clamp01(score) * 4);
    return {
      full: `${prefix} ${visualLabel(cvs, cc, idx, lv)} unlike=${unlike}/4 same=${4 - unlike}/4 score=${pct(score)}`,
      compact: `${compactPrefix} ${compactVisualLabel(cvs, cc, idx, lv)} unlike=${unlike}/4 score=${pct(score)}`,
    };
  } else if (mode === "luminance") {
    const g = LEVEL_INFO[lv].gray;
    return {
      full: `${prefix} ${LEVEL_INFO[lv].name} gray=${g} level=${lv}/7 t=${pct(lv / 7)}`,
      compact: `${compactPrefix} gray=${g} t=${pct(lv / 7)}`,
    };
  } else if (mode === "colorlum") {
    const rgb = colorLUT[lv];
    const candidate = resolveCandidate(lv, cc[lv] ?? 0);
    const y255 = luma255(rgb);
    return {
      full: `${prefix} ${candidateLabel(candidate)} ${hexStr(rgb)} Y=${y255}/255 ${pct(y255 / 255)} dGray=${signedInt(
        y255 - LEVEL_INFO[lv].gray,
      )}`,
      compact: `${compactPrefix} ${candidateLabel(candidate)} Y=${y255} dG=${signedInt(y255 - LEVEL_INFO[lv].gray)}`,
    };
  } else if (mode === "region") {
    const id = valueAt(pixelMaps.regionId, idx);
    const size = regionSizeById.get(id) ?? 0;
    const edge = valueAt(pixelMaps.isEdge, idx) ? "edge" : "interior";
    const scale = size < REGION_SMALL_THRESHOLD ? "small" : "normal";
    return {
      full: `${prefix} ${visualLabel(cvs, cc, idx, lv)} region#${id} size=${size}px ${edge} ${scale}`,
      compact: `${compactPrefix} ${compactVisualLabel(cvs, cc, idx, lv)} r#${shortCount(id)} ${shortCount(size)}px ${
        edge === "interior" ? "int" : "edge"
      } ${scale === "normal" ? "norm" : "small"}`,
    };
  }

  return { full: prefix, compact: compactPrefix };
}
