import { LEVEL_INFO, LUMA_B, LUMA_G, LUMA_R } from "../color-engine";
import { LEVEL_MASK } from "../constants";
import type { CanvasData, MapMode } from "../types";

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
}: {
  mode: MapMode;
  pixelMaps: AnalysisPixelMaps;
  colorLUT: AnalysisColorLUT;
  cvs: CanvasData;
  target: Uint32Array;
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
    const regionSize = buildRegionSizeMap(pixelMaps);
    const smallThreshold = 10;
    for (let i = 0; i < n; i++) {
      if (pixelMaps.isEdge[i]) {
        target[i] = 0xff000000;
        continue;
      }
      const id = pixelMaps.regionId[i];
      const size = regionSize.get(id) || 0;
      if (size < smallThreshold) {
        const t = 1 - size / smallThreshold;
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
  cvs,
  regionSizeById,
}: {
  x: number;
  y: number;
  mode: MapMode;
  pixelMaps: AnalysisPixelMaps;
  colorLUT: AnalysisColorLUT;
  cvs: CanvasData;
  regionSizeById: Map<number, number>;
}): string | null {
  const w = cvs.w;
  const h = cvs.h;
  if (x < 0 || x >= w || y < 0 || y >= h) return null;

  const idx = y * w + x;
  const lv = cvs.data[idx] & LEVEL_MASK;
  let info = `(${x},${y}) `;

  if (mode === "entropy") {
    const count = Math.round(pixelMaps.localDiversity[idx] * 7) + 1;
    info += `Diversity: ${count}/8 levels`;
  } else if (mode === "gradient") {
    const mag = pixelMaps.gradMag[idx];
    const deg = (((pixelMaps.gradAngle[idx] + Math.PI) / (2 * Math.PI)) * 360) | 0;
    info += mag < 0.01 ? "No gradient" : `Dir: ${deg}\u00B0 Mag: ${(mag * 100) | 0}%`;
  } else if (mode === "depth") {
    const raw = pixelMaps.depth[idx];
    info += `Depth: ${(raw * 100) | 0}%`;
  } else if (mode === "noise") {
    const n = Math.round(pixelMaps.noise[idx] * 4);
    info += `Isolation: ${n}/4`;
  } else if (mode === "luminance") {
    const g = LEVEL_INFO[lv].gray;
    info += `L${lv} ${LEVEL_INFO[lv].name} (Gray ${g})`;
  } else if (mode === "colorlum") {
    const rgb = colorLUT[lv];
    const lum = (LUMA_R * rgb[0] + LUMA_G * rgb[1] + LUMA_B * rgb[2]) / 255;
    info += `Luminance: ${(lum * 100) | 0}%`;
  } else if (mode === "region") {
    const id = pixelMaps.regionId[idx];
    info += `Region: ${regionSizeById.get(id) ?? "?"}px`;
  }

  return info;
}
