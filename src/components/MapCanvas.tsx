import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { LEVEL_INFO, LUMA_R, LUMA_G, LUMA_B } from "../color-engine";
import { LEVEL_MASK } from "../constants";
import type { CanvasData } from "../types";
import type { MapMode } from "./AnalyzePanel";
import {
  computeNoiseLevelNorm, computeDiversity, computeEdgeDepth,
  computeGradient, computeRegion,
} from "../utils/pixel-analysis";
import type { WorkerRequest, WorkerResponse } from "../workers/pixel-analysis.worker";
import { C, SP, FS, R } from "../tokens";
import PixelWorker from "../workers/pixel-analysis.worker?worker";

/* ── Scientific colormaps (32-stop LUTs, interpolated to 256) ── */
function buildLUT(stops: [number, number, number][]): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  const n = stops.length - 1;
  for (let i = 0; i < 256; i++) {
    const t = i / 255 * n;
    const idx = Math.min(n - 1, t | 0);
    const f = t - idx;
    const a = stops[idx], b = stops[idx + 1];
    lut[i * 3] = (a[0] + (b[0] - a[0]) * f) | 0;
    lut[i * 3 + 1] = (a[1] + (b[1] - a[1]) * f) | 0;
    lut[i * 3 + 2] = (a[2] + (b[2] - a[2]) * f) | 0;
  }
  return lut;
}

function applyLUT(lut: Uint8Array, v: number): [number, number, number] {
  const i = Math.max(0, Math.min(255, (v * 255) | 0)) * 3;
  return [lut[i], lut[i + 1], lut[i + 2]];
}

// viridis: dark purple → teal → yellow-green
const VIRIDIS = buildLUT([
  [68,1,84],[72,20,103],[72,38,119],[67,56,131],[59,72,138],[48,87,140],
  [39,100,141],[31,113,141],[24,125,139],[19,137,135],[15,149,130],[23,160,121],
  [50,171,109],[82,180,92],[119,189,69],[160,196,43],[202,201,31],[246,207,35],
  [253,231,37]
]);

// magma: black → deep purple → red-orange → yellow-white
const MAGMA = buildLUT([
  [0,0,4],[10,7,34],[30,12,69],[56,15,100],[81,18,124],[106,21,141],
  [132,26,148],[156,39,146],[179,56,137],[199,78,123],[215,103,109],[228,130,95],
  [239,159,84],[247,189,83],[251,218,95],[252,244,130],[252,253,191]
]);

// inferno: black → deep purple → red → orange → yellow-white
const INFERNO = buildLUT([
  [0,0,4],[11,7,36],[35,10,73],[64,10,103],[90,12,122],[116,16,130],
  [142,22,128],[166,36,118],[187,55,103],[205,79,84],[219,106,63],[230,134,42],
  [238,165,26],[242,196,22],[243,228,40],[245,253,105],[252,255,164]
]);

// plasma: deep blue → purple → red → orange → yellow
const PLASMA = buildLUT([
  [13,8,135],[50,10,162],[84,15,176],[115,24,180],[143,38,174],[167,55,162],
  [188,73,145],[204,93,125],[217,113,106],[227,135,87],[235,157,68],[240,180,50],
  [243,203,35],[242,226,30],[237,248,46],[240,249,33]
]);

// turbo: dark blue → cyan → green → yellow → red → dark red
const TURBO = buildLUT([
  [48,18,59],[61,55,137],[65,95,190],[56,133,217],[40,168,222],[33,196,206],
  [42,218,171],[72,233,131],[114,242,90],[163,245,57],[210,240,37],[247,225,34],
  [254,198,40],[249,163,42],[234,126,39],[212,89,31],[182,55,22],[144,28,14],[122,4,3]
]);

/* ── Pixel maps hook ── */
export interface PixelMaps {
  noise: Float32Array; depth: Float32Array; gradAngle: Float32Array; gradMag: Float32Array;
  regionId: Int32Array; isEdge: Uint8Array; levelNorm: Float32Array; localDiversity: Float32Array;
  w: number; h: number;
}

/** Synchronous fallback for pixel maps (used when Worker is unavailable). */
function computePixelMapsSync(cvs: CanvasData, mode: MapMode): PixelMaps {
  const { data, w, h } = cvs;
  const n = w * h;
  const maps: PixelMaps = {
    noise: new Float32Array(n), depth: new Float32Array(n),
    gradAngle: new Float32Array(n), gradMag: new Float32Array(n),
    regionId: new Int32Array(n), isEdge: new Uint8Array(n),
    levelNorm: new Float32Array(n), localDiversity: new Float32Array(n), w, h,
  };
  if (n === 0) return maps;
  switch (mode) {
    case "noise": computeNoiseLevelNorm(data, w, h, maps.noise, maps.levelNorm, cvs.colorMap); break;
    case "entropy": computeDiversity(data, w, h, maps.localDiversity, cvs.colorMap); break;
    case "depth": computeEdgeDepth(data, w, h, maps.isEdge, maps.depth, cvs.colorMap); break;
    case "gradient": computeGradient(data, w, h, maps.levelNorm, maps.gradAngle, maps.gradMag); break;
    case "region": computeRegion(data, w, h, maps.regionId, maps.isEdge, cvs.colorMap); break;
    case "luminance": for (let i = 0; i < n; i++) maps.levelNorm[i] = (data[i] & LEVEL_MASK) / 7; break;
    case "colorlum": break;
  }
  return maps;
}

const emptyMaps = (w: number, h: number): PixelMaps => {
  const n = w * h;
  return {
    noise: new Float32Array(n), depth: new Float32Array(n),
    gradAngle: new Float32Array(n), gradMag: new Float32Array(n),
    regionId: new Int32Array(n), isEdge: new Uint8Array(n),
    levelNorm: new Float32Array(n), localDiversity: new Float32Array(n), w, h,
  };
};

/**
 * Async pixel maps hook: offloads heavy computation to a Web Worker.
 * Falls back to synchronous computation for lightweight modes (luminance, colorlum).
 */
export function usePixelMaps(cvs: CanvasData, mode: MapMode): PixelMaps {
  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);
  const [maps, setMaps] = useState<PixelMaps>(() => emptyMaps(cvs.w, cvs.h));

  // Cleanup worker on unmount
  useEffect(() => {
    return () => { workerRef.current?.terminate(); };
  }, []);

  useEffect(() => {
    const { data, w, h } = cvs;
    // Compute all modes synchronously — avoids Worker ArrayBuffer transfer complexity
    // and is fast enough for typical canvas sizes (up to 1024x1024)
    setMaps(computePixelMapsSync(cvs, mode));
    return;

    // eslint-disable-next-line no-unreachable -- Worker path kept for future use with large canvases
    // Lightweight modes: compute synchronously (no worker overhead needed)
    if (mode === "luminance" || mode === "colorlum") {
      setMaps(computePixelMapsSync(cvs, mode));
      return;
    }

    // Ensure worker is initialized
    if (!workerRef.current) {
      try {
        workerRef.current = new PixelWorker();
      } catch {
        // Worker creation failed (e.g., in test env) — fallback to sync
        setMaps(computePixelMapsSync(cvs, mode));
        return;
      }
    }

    const id = ++reqIdRef.current;
    const worker = workerRef.current!;

    const handler = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id !== id) return; // stale response
      worker.removeEventListener("message", handler);
      setMaps(e.data as unknown as PixelMaps);
    };
    worker.addEventListener("message", handler);

    // Send data copies to worker (they'll be transferred back)
    const dataCopy = new Uint8Array(data);
    const cmCopy = new Uint8Array(cvs.colorMap);
    const req: WorkerRequest = { id, mode, data: dataCopy, colorMap: cmCopy, w, h };
    worker.postMessage(req, [dataCopy.buffer as ArrayBuffer, cmCopy.buffer as ArrayBuffer]);

    return () => { worker.removeEventListener("message", handler); };
  }, [cvs, mode]);

  return maps;
}

/* ── Map canvas component ── */
export function MapCanvas({ mode, pixelMaps, colorLUT, cvs, displayW, displayH }: {
  mode: MapMode;
  pixelMaps: PixelMaps;
  colorLUT: [number, number, number][];
  cvs: CanvasData;
  displayW: number;
  displayH: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cw = cvs.w;
  const ch = cvs.h;

  useEffect(() => {
    const c = ref.current;
    if (!c || cw === 0 || ch === 0) return;
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(cw, ch);
    const d32 = new Uint32Array(img.data.buffer);
    const n = cw * ch;

    // Skip rendering if pixelMaps dimensions don't match canvas (stale worker response)
    if (pixelMaps.w !== cw || pixelMaps.h !== ch) { ctx.putImageData(img, 0, 0); return; }

    if (mode === "entropy" && pixelMaps.localDiversity.length >= n) {
      const pm = pixelMaps;
      for (let i = 0; i < n; i++) {
        const [r, g, b] = applyLUT(VIRIDIS, pm.localDiversity[i]);
        d32[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
      }
    } else if (mode === "noise" && pixelMaps.noise.length >= n) {
      const pm = pixelMaps;
      for (let i = 0; i < n; i++) {
        const v = pm.noise[i];
        const [r, g, b] = applyLUT(INFERNO, v * v);
        d32[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
      }
    } else if (mode === "depth" && pixelMaps.depth.length >= n) {
      const pm = pixelMaps;
      for (let i = 0; i < n; i++) {
        const [r, g, b] = applyLUT(TURBO, 1 - pm.depth[i]);
        d32[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
      }
    } else if (mode === "luminance" && pixelMaps.levelNorm.length >= n) {
      const pm = pixelMaps;
      for (let i = 0; i < n; i++) {
        const [r, g, b] = applyLUT(MAGMA, pm.levelNorm[i]);
        d32[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
      }
    } else if (mode === "colorlum") {
      for (let i = 0; i < n; i++) {
        const lv = cvs.data[i] & LEVEL_MASK;
        const rgb = colorLUT[lv];
        const lumVal = (LUMA_R * rgb[0] + LUMA_G * rgb[1] + LUMA_B * rgb[2]) / 255;
        const [r, g, b] = applyLUT(PLASMA, lumVal);
        d32[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
      }
    } else if (mode === "gradient" && pixelMaps.gradMag.length >= n && pixelMaps.levelNorm.length >= n) {
      const pm = pixelMaps;
      for (let i = 0; i < n; i++) {
        const mag = pm.gradMag[i];
        if (mag < 0.01) {
          const g2 = (pm.levelNorm[i] * 30 + 8) | 0;
          d32[i] = 0xFF000000 | (g2 << 16) | (g2 << 8) | g2;
          continue;
        }
        const hue = ((pm.gradAngle[i] + Math.PI) / (2 * Math.PI)) * 360;
        const l = 0.15 + mag * 0.4, s2 = 0.7 + mag * 0.3;
        const c2 = (1 - Math.abs(2 * l - 1)) * s2;
        const x = c2 * (1 - Math.abs((hue / 60) % 2 - 1));
        const m = l - c2 / 2;
        let r1 = 0, g1 = 0, b1 = 0;
        if (hue < 60) { r1 = c2; g1 = x; }
        else if (hue < 120) { r1 = x; g1 = c2; }
        else if (hue < 180) { g1 = c2; b1 = x; }
        else if (hue < 240) { g1 = x; b1 = c2; }
        else if (hue < 300) { r1 = x; b1 = c2; }
        else { r1 = c2; b1 = x; }
        d32[i] = 0xFF000000 | (((b1 + m) * 255) << 16) | (((g1 + m) * 255) << 8) | ((r1 + m) * 255);
      }
    } else if (mode === "region" && pixelMaps.regionId.length >= n && pixelMaps.isEdge.length >= n) {
      const pm = pixelMaps;
      const PHI = 0.618033988749895;
      const regionSize = new Map<number, number>();
      for (let i = 0; i < n; i++) {
        const id = pm.regionId[i];
        regionSize.set(id, (regionSize.get(id) || 0) + 1);
      }
      const SMALL_THRESHOLD = 10;
      for (let i = 0; i < n; i++) {
        if (pm.isEdge[i]) {
          d32[i] = 0xFF000000;
          continue;
        }
        const id = pm.regionId[i];
        const size = regionSize.get(id) || 0;
        if (size < SMALL_THRESHOLD) {
          const t = 1 - size / SMALL_THRESHOLD;
          d32[i] = 0xFF000000 | (((t * 100) | 0) << 16) | (((t * 100) | 0) << 8) | 255;
          continue;
        }
        const hue = ((id * PHI) % 1) * 360;
        const sat = 0.6 + ((id * 0.1337) % 1) * 0.4;
        const lit = 0.35 + ((id * 0.7919) % 1) * 0.3;
        const c2 = (1 - Math.abs(2 * lit - 1)) * sat;
        const x = c2 * (1 - Math.abs((hue / 60) % 2 - 1));
        const m = lit - c2 / 2;
        let r1 = 0, g1 = 0, b1 = 0;
        if (hue < 60) { r1 = c2; g1 = x; }
        else if (hue < 120) { r1 = x; g1 = c2; }
        else if (hue < 180) { g1 = c2; b1 = x; }
        else if (hue < 240) { g1 = x; b1 = c2; }
        else if (hue < 300) { r1 = x; b1 = c2; }
        else { r1 = c2; b1 = x; }
        d32[i] = 0xFF000000 | (((b1 + m) * 255) << 16) | (((g1 + m) * 255) << 8) | ((r1 + m) * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [mode, pixelMaps, colorLUT, cvs, cw, ch]);

  // Hover info
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  const _regionSizeCache = useMemo(() => {
    const m = new Map<number, number>();
    const pm = pixelMaps;
    for (let i = 0; i < pm.w * pm.h; i++) {
      const id = pm.regionId[i];
      m.set(id, (m.get(id) || 0) + 1);
    }
    return m;
  }, [pixelMaps]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width * cw) | 0;
    const py = ((e.clientY - rect.top) / rect.height * ch) | 0;
    if (px < 0 || px >= cw || py < 0 || py >= ch) { setHoverInfo(null); return; }
    const idx = py * cw + px;
    const pm = pixelMaps;
    const lv = cvs.data[idx] & LEVEL_MASK;

    let info = `(${px},${py}) `;
    if (mode === "entropy") {
      const count = Math.round(pm.localDiversity[idx] * 7) + 1;
      info += `Diversity: ${count}/8 levels`;
    } else if (mode === "gradient") {
      const mag = pm.gradMag[idx];
      const deg = ((pm.gradAngle[idx] + Math.PI) / (2 * Math.PI) * 360) | 0;
      info += mag < 0.01 ? "No gradient" : `Dir: ${deg}\u00B0 Mag: ${(mag * 100) | 0}%`;
    } else if (mode === "depth") {
      const raw = pm.depth[idx];
      info += `Depth: ${(raw * 100) | 0}%`;
    } else if (mode === "noise") {
      const n = Math.round(pm.noise[idx] * 4);
      info += `Isolation: ${n}/4`;
    } else if (mode === "luminance") {
      const g = LEVEL_INFO[lv].gray;
      info += `L${lv} ${LEVEL_INFO[lv].name} (Gray ${g})`;
    } else if (mode === "colorlum") {
      const rgb = colorLUT[lv];
      const lum = (LUMA_R * rgb[0] + LUMA_G * rgb[1] + LUMA_B * rgb[2]) / 255;
      info += `Luminance: ${(lum * 100) | 0}%`;
    } else if (mode === "region") {
      const id = pm.regionId[idx];
      info += `Region: ${_regionSizeCache.get(id) ?? "?"}px`;
    }
    setHoverInfo(info);
  }, [mode, pixelMaps, colorLUT, cvs, cw, ch, _regionSizeCache]);

  const onMouseLeave = useCallback(() => setHoverInfo(null), []);

  return (
    <div>
      <canvas ref={ref} width={cw || 1} height={ch || 1}
        onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
        style={{ width: displayW, height: displayH, display: "block", imageRendering: "pixelated", borderRadius: R.lg, border: `1px solid ${C.border}`, cursor: "crosshair" }} />
      <div style={{ fontSize: FS.xs, color: C.textDimmer, fontFamily: "monospace", textAlign: "center", minHeight: 14, marginTop: SP.xs }}>
        {hoverInfo ?? "\u00A0"}
      </div>
    </div>
  );
}
