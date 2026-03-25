/**
 * Web Worker for pixel analysis computations.
 * Offloads heavy O(w*h) calculations from the main thread.
 */
import { computeNoiseLevelNorm, computeDiversity, computeEdgeDepth, computeGradient, computeRegion } from "../utils/pixel-analysis";
import { LEVEL_MASK } from "../constants";

export type MapMode = "region" | "entropy" | "noise" | "depth" | "gradient" | "luminance" | "colorlum";

export interface WorkerRequest {
  id: number;
  mode: MapMode;
  data: Uint8Array;
  colorMap: Uint8Array;
  w: number;
  h: number;
}

export interface WorkerResponse {
  id: number;
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

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, mode, data, colorMap, w, h } = e.data;
  const n = w * h;
  const result: WorkerResponse = {
    id,
    noise: new Float32Array(n),
    depth: new Float32Array(n),
    gradAngle: new Float32Array(n),
    gradMag: new Float32Array(n),
    regionId: new Int32Array(n),
    isEdge: new Uint8Array(n),
    levelNorm: new Float32Array(n),
    localDiversity: new Float32Array(n),
    w, h,
  };

  if (n === 0) {
    self.postMessage(result);
    return;
  }

  switch (mode) {
    case "noise":
      computeNoiseLevelNorm(data, w, h, result.noise, result.levelNorm, colorMap);
      break;
    case "entropy":
      computeDiversity(data, w, h, result.localDiversity, colorMap);
      break;
    case "depth":
      computeEdgeDepth(data, w, h, result.isEdge, result.depth, colorMap);
      break;
    case "gradient":
      computeGradient(data, w, h, result.levelNorm, result.gradAngle, result.gradMag);
      break;
    case "region":
      computeRegion(data, w, h, result.regionId, result.isEdge, colorMap);
      break;
    case "luminance":
      for (let i = 0; i < n; i++) result.levelNorm[i] = (data[i] & LEVEL_MASK) / 7;
      break;
    case "colorlum":
      // No pre-computation needed for colorlum
      break;
  }

  // Transfer typed arrays for zero-copy
  const transfer: Transferable[] = [
    result.noise.buffer as ArrayBuffer, result.depth.buffer as ArrayBuffer,
    result.gradAngle.buffer as ArrayBuffer, result.gradMag.buffer as ArrayBuffer,
    result.regionId.buffer as ArrayBuffer, result.isEdge.buffer as ArrayBuffer,
    result.levelNorm.buffer as ArrayBuffer, result.localDiversity.buffer as ArrayBuffer,
  ];
  (self as unknown as Worker).postMessage(result, transfer);
};
