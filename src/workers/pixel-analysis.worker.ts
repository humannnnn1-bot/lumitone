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

  const needsNoise = mode === "noise";
  const needsDepth = mode === "depth";
  const needsGrad = mode === "gradient";
  const needsRegion = mode === "region";
  const needsEdge = mode === "depth" || mode === "region";
  const needsLevelNorm = mode === "luminance" || mode === "noise" || mode === "gradient";
  const needsDiversity = mode === "entropy";

  const result: WorkerResponse = {
    id,
    noise: new Float32Array(needsNoise ? n : 0),
    depth: new Float32Array(needsDepth ? n : 0),
    gradAngle: new Float32Array(needsGrad ? n : 0),
    gradMag: new Float32Array(needsGrad ? n : 0),
    regionId: new Int32Array(needsRegion ? n : 0),
    isEdge: new Uint8Array(needsEdge ? n : 0),
    levelNorm: new Float32Array(needsLevelNorm ? n : 0),
    localDiversity: new Float32Array(needsDiversity ? n : 0),
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

  // Transfer typed arrays for zero-copy (only non-empty buffers)
  const transfer: Transferable[] = [];
  const arrays = [result.noise, result.depth, result.gradAngle, result.gradMag,
                  result.regionId, result.isEdge, result.levelNorm, result.localDiversity];
  for (const arr of arrays) {
    if (arr.byteLength > 0) transfer.push(arr.buffer as ArrayBuffer);
  }
  (self as unknown as Worker).postMessage(result, transfer);
};
