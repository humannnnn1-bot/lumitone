/**
 * Web Worker for pixel analysis computations.
 * Offloads heavy O(w*h) calculations from the main thread.
 */
import {
  computeNeighborIsolationAndLevelTone,
  computeLocalDiversity,
  computeBoundaryDistance,
  computeGradient,
  computeRegion,
} from "../utils/pixel-analysis";
import { LEVEL_MASK } from "../constants";
import type { AnalysisPixelMaps, MapMode } from "../types";

export interface PixelAnalysisWorkerRequest {
  id: number;
  mode: MapMode;
  levelData: Uint8Array;
  pixelCandidateOverrideMap: Uint8Array;
  width: number;
  height: number;
}

export interface PixelAnalysisWorkerResponse extends AnalysisPixelMaps {
  id: number;
}

self.onmessage = (e: MessageEvent<PixelAnalysisWorkerRequest>) => {
  const { id, mode, levelData, pixelCandidateOverrideMap, width, height } = e.data;
  const n = width * height;

  const needsIsolation = mode === "isolation";
  const needsDepth = mode === "boundaryDistance";
  const needsGrad = mode === "gradient";
  const needsRegion = mode === "region";
  const needsEdge = mode === "boundaryDistance" || mode === "region";
  const needsLevelTone = mode === "luminance" || mode === "isolation" || mode === "gradient";
  const needsDiversity = mode === "diversity";

  const result: PixelAnalysisWorkerResponse = {
    id,
    neighborIsolation: new Float32Array(needsIsolation ? n : 0),
    boundaryDistance: new Float32Array(needsDepth ? n : 0),
    gradientAngle: new Float32Array(needsGrad ? n : 0),
    gradientMagnitude: new Float32Array(needsGrad ? n : 0),
    regionId: new Int32Array(needsRegion ? n : 0),
    isEdge: new Uint8Array(needsEdge ? n : 0),
    levelTone: new Float32Array(needsLevelTone ? n : 0),
    localDiversity: new Float32Array(needsDiversity ? n : 0),
    width,
    height,
  };

  if (n === 0) {
    self.postMessage(result);
    return;
  }

  switch (mode) {
    case "isolation":
      computeNeighborIsolationAndLevelTone(levelData, width, height, result.neighborIsolation, result.levelTone, pixelCandidateOverrideMap);
      break;
    case "diversity":
      computeLocalDiversity(levelData, width, height, result.localDiversity, pixelCandidateOverrideMap);
      break;
    case "boundaryDistance":
      computeBoundaryDistance(levelData, width, height, result.isEdge, result.boundaryDistance, pixelCandidateOverrideMap);
      break;
    case "gradient":
      computeGradient(levelData, width, height, result.levelTone, result.gradientAngle, result.gradientMagnitude);
      break;
    case "region":
      computeRegion(levelData, width, height, result.regionId, result.isEdge, pixelCandidateOverrideMap);
      break;
    case "luminance":
      for (let i = 0; i < n; i++) result.levelTone[i] = (levelData[i] & LEVEL_MASK) / 7;
      break;
    case "colorLuma":
      // No pre-computation needed for colorLuma
      break;
  }

  // Transfer typed arrays for zero-copy (only non-empty buffers)
  const transfer: Transferable[] = [];
  const arrays = [
    result.neighborIsolation,
    result.boundaryDistance,
    result.gradientAngle,
    result.gradientMagnitude,
    result.regionId,
    result.isEdge,
    result.levelTone,
    result.localDiversity,
  ];
  for (const arr of arrays) {
    if (arr.byteLength > 0) transfer.push(arr.buffer as ArrayBuffer);
  }
  (self as unknown as Worker).postMessage(result, transfer);
};
