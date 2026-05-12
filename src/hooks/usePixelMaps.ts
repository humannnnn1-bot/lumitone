import { useCallback, useEffect, useRef, useState } from "react";

import { LEVEL_MASK } from "../constants";
import type { AnalysisPixelMaps, CanvasData, MapMode } from "../types";
import {
  computeNeighborIsolationAndLevelTone,
  computeLocalDiversity,
  computeBoundaryDistance,
  computeGradient,
  computeRegion,
} from "../utils/pixel-analysis";
import type { PixelAnalysisWorkerRequest, PixelAnalysisWorkerResponse } from "../workers/pixel-analysis.worker";
import { recordDebugPerf, startDebugPerf } from "../utils/perf-debug";

// Lazy worker constructor — Vite ?worker import
import PixelAnalysisWorker from "../workers/pixel-analysis.worker?worker";

const WORKER_MODES = new Set<MapMode>(["isolation", "diversity", "boundaryDistance", "gradient", "region"]);
const PRELOAD_ORDER: readonly MapMode[] = ["luminance", "isolation", "gradient", "region", "boundaryDistance", "diversity"];

type PixelMapsCache = {
  levelData: Uint8Array;
  pixelCandidateOverrideMap: Uint8Array;
  width: number;
  height: number;
  byMode: Partial<Record<MapMode, AnalysisPixelMaps>>;
};

function emptyPixelMaps(width: number, height: number): AnalysisPixelMaps {
  const n = width * height;
  return {
    neighborIsolation: new Float32Array(n),
    boundaryDistance: new Float32Array(n),
    gradientAngle: new Float32Array(n),
    gradientMagnitude: new Float32Array(n),
    regionId: new Int32Array(n),
    isEdge: new Uint8Array(n),
    levelTone: new Float32Array(n),
    localDiversity: new Float32Array(n),
    width,
    height,
  };
}

/** Synchronous fallback for pixel maps (used when Worker is unavailable). */
function computePixelMapsSync(canvasData: CanvasData, mode: MapMode): AnalysisPixelMaps {
  const { levelData, width, height } = canvasData;
  const n = width * height;
  const maps = emptyPixelMaps(width, height);
  if (n === 0) return maps;
  switch (mode) {
    case "isolation":
      computeNeighborIsolationAndLevelTone(
        levelData,
        width,
        height,
        maps.neighborIsolation,
        maps.levelTone,
        canvasData.pixelCandidateOverrideMap,
      );
      break;
    case "diversity":
      computeLocalDiversity(levelData, width, height, maps.localDiversity, canvasData.pixelCandidateOverrideMap);
      break;
    case "boundaryDistance":
      computeBoundaryDistance(levelData, width, height, maps.isEdge, maps.boundaryDistance, canvasData.pixelCandidateOverrideMap);
      break;
    case "gradient":
      computeGradient(levelData, width, height, maps.levelTone, maps.gradientAngle, maps.gradientMagnitude);
      break;
    case "region":
      computeRegion(levelData, width, height, maps.regionId, maps.isEdge, canvasData.pixelCandidateOverrideMap);
      break;
    case "luminance":
      for (let i = 0; i < n; i++) maps.levelTone[i] = (levelData[i] & LEVEL_MASK) / 7;
      break;
    case "colorLuma":
      break;
  }
  return maps;
}

function toPixelMaps(result: PixelAnalysisWorkerResponse): AnalysisPixelMaps {
  return {
    neighborIsolation: result.neighborIsolation,
    boundaryDistance: result.boundaryDistance,
    gradientAngle: result.gradientAngle,
    gradientMagnitude: result.gradientMagnitude,
    regionId: result.regionId,
    isEdge: result.isEdge,
    levelTone: result.levelTone,
    localDiversity: result.localDiversity,
    width: result.width,
    height: result.height,
  };
}

function isSameCanvas(cache: PixelMapsCache | null, canvasData: CanvasData): cache is PixelMapsCache {
  return (
    cache !== null &&
    cache.width === canvasData.width &&
    cache.height === canvasData.height &&
    cache.levelData === canvasData.levelData &&
    cache.pixelCandidateOverrideMap === canvasData.pixelCandidateOverrideMap
  );
}

export function usePixelMaps(canvasData: CanvasData, mode: MapMode, preload = false): AnalysisPixelMaps {
  const [maps, setMaps] = useState<AnalysisPixelMaps>(() => emptyPixelMaps(canvasData.width, canvasData.height));
  const workerRef = useRef<Worker | null>(null);
  const preloadWorkerRef = useRef<Worker | null>(null);
  const workerFailedRef = useRef(false);
  const requestIdRef = useRef(0);
  const preloadRequestIdRef = useRef(0);
  const cacheRef = useRef<PixelMapsCache | null>(null);

  const ensureCache = useCallback((): PixelMapsCache => {
    if (!isSameCanvas(cacheRef.current, canvasData)) {
      cacheRef.current = {
        levelData: canvasData.levelData,
        pixelCandidateOverrideMap: canvasData.pixelCandidateOverrideMap,
        width: canvasData.width,
        height: canvasData.height,
        byMode: {},
      };
    }
    return cacheRef.current;
  }, [canvasData]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      preloadWorkerRef.current?.terminate();
      preloadWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cache = ensureCache();
    const cachedMaps = cache.byMode[mode];
    if (cachedMaps) {
      setMaps(cachedMaps);
      return;
    }

    if (!WORKER_MODES.has(mode)) {
      const perfStart = startDebugPerf();
      const nextMaps = computePixelMapsSync(canvasData, mode);
      cache.byMode[mode] = nextMaps;
      setMaps(nextMaps);
      recordDebugPerf(`pixel-analysis:${mode}:sync`, perfStart, {
        w: canvasData.width,
        h: canvasData.height,
        pixels: canvasData.width * canvasData.height,
      });
      return;
    }

    let worker = workerRef.current;
    if (!worker && !workerFailedRef.current) {
      try {
        worker = new PixelAnalysisWorker();
        workerRef.current = worker;
      } catch {
        workerFailedRef.current = true;
      }
    }

    if (!worker) {
      const perfStart = startDebugPerf();
      const nextMaps = computePixelMapsSync(canvasData, mode);
      cache.byMode[mode] = nextMaps;
      setMaps(nextMaps);
      recordDebugPerf(`pixel-analysis:${mode}:sync-fallback`, perfStart, {
        w: canvasData.width,
        h: canvasData.height,
        pixels: canvasData.width * canvasData.height,
      });
      return;
    }

    const id = ++requestIdRef.current;
    const perfStart = startDebugPerf();
    const dataCopy = new Uint8Array(canvasData.levelData);
    const overrideMapCopy = new Uint8Array(canvasData.pixelCandidateOverrideMap);
    const req: PixelAnalysisWorkerRequest = {
      id,
      mode,
      levelData: dataCopy,
      pixelCandidateOverrideMap: overrideMapCopy,
      width: canvasData.width,
      height: canvasData.height,
    };
    let disposed = false;

    const resetWorker = () => {
      if (workerRef.current === worker) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };

    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };

    const fallbackToSync = () => {
      cleanup();
      if (disposed) return;
      const nextMaps = computePixelMapsSync(canvasData, mode);
      cache.byMode[mode] = nextMaps;
      setMaps(nextMaps);
      recordDebugPerf(`pixel-analysis:${mode}:sync-fallback`, perfStart, {
        status: "worker-error",
        w: canvasData.width,
        h: canvasData.height,
        pixels: canvasData.width * canvasData.height,
      });
    };

    const handleMessage = (e: MessageEvent<PixelAnalysisWorkerResponse>) => {
      if (e.data.id !== id) return;
      cleanup();
      if (disposed) return;
      const nextMaps = toPixelMaps(e.data);
      cache.byMode[mode] = nextMaps;
      setMaps(nextMaps);
      recordDebugPerf(`pixel-analysis:${mode}:worker`, perfStart, {
        w: canvasData.width,
        h: canvasData.height,
        pixels: canvasData.width * canvasData.height,
      });
    };

    const handleError = () => {
      resetWorker();
      fallbackToSync();
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    try {
      worker.postMessage(req, [dataCopy.buffer as ArrayBuffer, overrideMapCopy.buffer as ArrayBuffer]);
    } catch {
      handleError();
    }

    return () => {
      disposed = true;
      cleanup();
    };
  }, [canvasData, mode, ensureCache]);

  useEffect(() => {
    if (!preload) return;

    const cache = ensureCache();
    if (!cache.byMode[mode]) return;

    const queue = PRELOAD_ORDER.filter((candidate) => candidate !== mode && !cache.byMode[candidate]);
    if (queue.length === 0) return;

    let worker = preloadWorkerRef.current;
    if (!worker && !workerFailedRef.current) {
      try {
        worker = new PixelAnalysisWorker();
        preloadWorkerRef.current = worker;
      } catch {
        workerFailedRef.current = true;
      }
    }

    if (!worker) return;

    let disposed = false;
    let pendingId = 0;
    let pendingMode: MapMode | null = null;
    let pendingPerfStart: number | null = null;

    const resetWorker = () => {
      if (preloadWorkerRef.current === worker) {
        preloadWorkerRef.current.terminate();
        preloadWorkerRef.current = null;
      }
    };

    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };

    const runNext = () => {
      if (disposed || !isSameCanvas(cacheRef.current, canvasData)) {
        cleanup();
        return;
      }

      const nextMode = queue.find((candidate) => !cache.byMode[candidate]);
      if (!nextMode) {
        cleanup();
        return;
      }

      pendingMode = nextMode;
      pendingId = ++preloadRequestIdRef.current;
      pendingPerfStart = startDebugPerf();
      const dataCopy = new Uint8Array(canvasData.levelData);
      const overrideMapCopy = new Uint8Array(canvasData.pixelCandidateOverrideMap);
      const req: PixelAnalysisWorkerRequest = {
        id: pendingId,
        mode: nextMode,
        levelData: dataCopy,
        pixelCandidateOverrideMap: overrideMapCopy,
        width: canvasData.width,
        height: canvasData.height,
      };
      try {
        worker.postMessage(req, [dataCopy.buffer as ArrayBuffer, overrideMapCopy.buffer as ArrayBuffer]);
      } catch {
        handleError();
      }
    };

    const handleMessage = (e: MessageEvent<PixelAnalysisWorkerResponse>) => {
      if (e.data.id !== pendingId || !pendingMode) return;
      if (!isSameCanvas(cacheRef.current, canvasData)) {
        cleanup();
        return;
      }
      cache.byMode[pendingMode] = toPixelMaps(e.data);
      recordDebugPerf(`pixel-analysis:${pendingMode}:preload-worker`, pendingPerfStart, {
        w: canvasData.width,
        h: canvasData.height,
        pixels: canvasData.width * canvasData.height,
      });
      pendingMode = null;
      pendingPerfStart = null;
      runNext();
    };

    const handleError = () => {
      if (pendingMode) {
        recordDebugPerf(`pixel-analysis:${pendingMode}:preload-worker`, pendingPerfStart, {
          status: "error",
          w: canvasData.width,
          h: canvasData.height,
          pixels: canvasData.width * canvasData.height,
        });
      }
      cleanup();
      resetWorker();
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    runNext();

    return () => {
      disposed = true;
      cleanup();
      resetWorker();
    };
  }, [canvasData, mode, maps, preload, ensureCache]);

  return maps;
}
