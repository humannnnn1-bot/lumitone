/**
 * Web Worker for pixel analysis computations.
 * Offloads heavy O(w*h) calculations from the main thread.
 */
import { computeNoiseLevelNorm, computeDiversity, computeBoundaryDistance, computeGradient, computeRegion } from "../utils/pixel-analysis";
import { LEVEL_MASK } from "../constants";
import type { AnalysisPixelMaps, MapMode } from "../types";

export interface WorkerRequest {
  id: number;
  mode: MapMode;
  data: Uint8Array;
  colorMap: Uint8Array;
  w: number;
  h: number;
}

export interface WorkerResponse extends AnalysisPixelMaps {
  id: number;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, mode, data, colorMap, w, h } = e.data;
  const n = w * h;

  const needsNoise = mode === "noise";
  const needsDepth = mode === "boundaryDistance";
  const needsGrad = mode === "gradient";
  const needsRegion = mode === "region";
  const needsEdge = mode === "boundaryDistance" || mode === "region";
  const needsLevelNorm = mode === "luminance" || mode === "noise" || mode === "gradient";
  const needsDiversity = mode === "entropy";

  const result: WorkerResponse = {
    id,
    noise: new Float32Array(needsNoise ? n : 0),
    boundaryDistance: new Float32Array(needsDepth ? n : 0),
    gradientAngle: new Float32Array(needsGrad ? n : 0),
    gradientMagnitude: new Float32Array(needsGrad ? n : 0),
    regionId: new Int32Array(needsRegion ? n : 0),
    isEdge: new Uint8Array(needsEdge ? n : 0),
    levelNorm: new Float32Array(needsLevelNorm ? n : 0),
    localDiversity: new Float32Array(needsDiversity ? n : 0),
    w,
    h,
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
    case "boundaryDistance":
      computeBoundaryDistance(data, w, h, result.isEdge, result.boundaryDistance, colorMap);
      break;
    case "gradient":
      computeGradient(data, w, h, result.levelNorm, result.gradientAngle, result.gradientMagnitude);
      break;
    case "region":
      computeRegion(data, w, h, result.regionId, result.isEdge, colorMap);
      break;
    case "luminance":
      for (let i = 0; i < n; i++) result.levelNorm[i] = (data[i] & LEVEL_MASK) / 7;
      break;
    case "colorLuma":
      // No pre-computation needed for colorLuma
      break;
  }

  // Transfer typed arrays for zero-copy (only non-empty buffers)
  const transfer: Transferable[] = [];
  const arrays = [
    result.noise,
    result.boundaryDistance,
    result.gradientAngle,
    result.gradientMagnitude,
    result.regionId,
    result.isEdge,
    result.levelNorm,
    result.localDiversity,
  ];
  for (const arr of arrays) {
    if (arr.byteLength > 0) transfer.push(arr.buffer as ArrayBuffer);
  }
  (self as unknown as Worker).postMessage(result, transfer);
};
