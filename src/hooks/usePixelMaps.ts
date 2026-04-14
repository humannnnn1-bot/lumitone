import { useEffect, useRef, useState } from "react";

import { LEVEL_MASK } from "../constants";
import type { CanvasData } from "../types";
import type { MapMode } from "../components/analyze-types";
import { computeNoiseLevelNorm, computeDiversity, computeEdgeDepth, computeGradient, computeRegion } from "../utils/pixel-analysis";
import type { WorkerRequest, WorkerResponse } from "../workers/pixel-analysis.worker";

// Lazy worker constructor — Vite ?worker import
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite worker import
import PixelAnalysisWorker from "../workers/pixel-analysis.worker?worker";

const WORKER_MODES = new Set<MapMode>(["noise", "entropy", "depth", "gradient", "region"]);
const PRELOAD_ORDER: readonly MapMode[] = ["luminance", "noise", "gradient", "region", "depth", "entropy"];

export interface PixelMaps {
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

type PixelMapsCache = {
  data: Uint8Array;
  colorMap: Uint8Array;
  w: number;
  h: number;
  byMode: Partial<Record<MapMode, PixelMaps>>;
};

export function emptyPixelMaps(w: number, h: number): PixelMaps {
  const n = w * h;
  return {
    noise: new Float32Array(n),
    depth: new Float32Array(n),
    gradAngle: new Float32Array(n),
    gradMag: new Float32Array(n),
    regionId: new Int32Array(n),
    isEdge: new Uint8Array(n),
    levelNorm: new Float32Array(n),
    localDiversity: new Float32Array(n),
    w,
    h,
  };
}

/** Synchronous fallback for pixel maps (used when Worker is unavailable). */
export function computePixelMapsSync(cvs: CanvasData, mode: MapMode): PixelMaps {
  const { data, w, h } = cvs;
  const n = w * h;
  const maps = emptyPixelMaps(w, h);
  if (n === 0) return maps;
  switch (mode) {
    case "noise":
      computeNoiseLevelNorm(data, w, h, maps.noise, maps.levelNorm, cvs.colorMap);
      break;
    case "entropy":
      computeDiversity(data, w, h, maps.localDiversity, cvs.colorMap);
      break;
    case "depth":
      computeEdgeDepth(data, w, h, maps.isEdge, maps.depth, cvs.colorMap);
      break;
    case "gradient":
      computeGradient(data, w, h, maps.levelNorm, maps.gradAngle, maps.gradMag);
      break;
    case "region":
      computeRegion(data, w, h, maps.regionId, maps.isEdge, cvs.colorMap);
      break;
    case "luminance":
      for (let i = 0; i < n; i++) maps.levelNorm[i] = (data[i] & LEVEL_MASK) / 7;
      break;
    case "colorlum":
      break;
  }
  return maps;
}

function toPixelMaps(result: WorkerResponse): PixelMaps {
  return {
    noise: result.noise,
    depth: result.depth,
    gradAngle: result.gradAngle,
    gradMag: result.gradMag,
    regionId: result.regionId,
    isEdge: result.isEdge,
    levelNorm: result.levelNorm,
    localDiversity: result.localDiversity,
    w: result.w,
    h: result.h,
  };
}

function isSameCanvas(cache: PixelMapsCache | null, cvs: CanvasData): cache is PixelMapsCache {
  return cache !== null && cache.w === cvs.w && cache.h === cvs.h && cache.data === cvs.data && cache.colorMap === cvs.colorMap;
}

export function usePixelMaps(cvs: CanvasData, mode: MapMode, preload = false): PixelMaps {
  const [maps, setMaps] = useState<PixelMaps>(() => emptyPixelMaps(cvs.w, cvs.h));
  const workerRef = useRef<Worker | null>(null);
  const preloadWorkerRef = useRef<Worker | null>(null);
  const workerFailedRef = useRef(false);
  const requestIdRef = useRef(0);
  const preloadRequestIdRef = useRef(0);
  const cacheRef = useRef<PixelMapsCache | null>(null);

  const ensureCache = (): PixelMapsCache => {
    if (!isSameCanvas(cacheRef.current, cvs)) {
      cacheRef.current = {
        data: cvs.data,
        colorMap: cvs.colorMap,
        w: cvs.w,
        h: cvs.h,
        byMode: {},
      };
    }
    return cacheRef.current;
  };

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
      const nextMaps = computePixelMapsSync(cvs, mode);
      cache.byMode[mode] = nextMaps;
      setMaps(nextMaps);
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
      const nextMaps = computePixelMapsSync(cvs, mode);
      cache.byMode[mode] = nextMaps;
      setMaps(nextMaps);
      return;
    }

    const id = ++requestIdRef.current;
    const dataCopy = new Uint8Array(cvs.data);
    const colorMapCopy = new Uint8Array(cvs.colorMap);
    const req: WorkerRequest = { id, mode, data: dataCopy, colorMap: colorMapCopy, w: cvs.w, h: cvs.h };
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
      const nextMaps = computePixelMapsSync(cvs, mode);
      cache.byMode[mode] = nextMaps;
      setMaps(nextMaps);
    };

    const handleMessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id !== id) return;
      cleanup();
      if (disposed) return;
      const nextMaps = toPixelMaps(e.data);
      cache.byMode[mode] = nextMaps;
      setMaps(nextMaps);
    };

    const handleError = () => {
      resetWorker();
      fallbackToSync();
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    try {
      worker.postMessage(req, [dataCopy.buffer as ArrayBuffer, colorMapCopy.buffer as ArrayBuffer]);
    } catch {
      handleError();
    }

    return () => {
      disposed = true;
      cleanup();
    };
  }, [cvs, mode]);

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
      if (disposed || !isSameCanvas(cacheRef.current, cvs)) {
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
      const dataCopy = new Uint8Array(cvs.data);
      const colorMapCopy = new Uint8Array(cvs.colorMap);
      const req: WorkerRequest = { id: pendingId, mode: nextMode, data: dataCopy, colorMap: colorMapCopy, w: cvs.w, h: cvs.h };
      try {
        worker.postMessage(req, [dataCopy.buffer as ArrayBuffer, colorMapCopy.buffer as ArrayBuffer]);
      } catch {
        handleError();
      }
    };

    const handleMessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id !== pendingId || !pendingMode) return;
      if (!isSameCanvas(cacheRef.current, cvs)) {
        cleanup();
        return;
      }
      cache.byMode[pendingMode] = toPixelMaps(e.data);
      pendingMode = null;
      runNext();
    };

    const handleError = () => {
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
  }, [cvs, mode, maps, preload]);

  return maps;
}
