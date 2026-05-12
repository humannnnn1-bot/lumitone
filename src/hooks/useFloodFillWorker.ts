/**
 * Hook that manages a Web Worker for flood fill operations.
 * Provides async fill functions that offload work from the main thread.
 * Falls back to synchronous execution if Worker creation fails (e.g. test env).
 */
import { useRef, useEffect, useCallback } from "react";
import { floodFill, glazeFloodFill } from "../drawing/flood-fill";
import type { FloodFillWorkerRequest, FloodFillWorkerResponse } from "../workers/flood-fill.worker";
import { recordDebugPerf, startDebugPerf } from "../utils/perf-debug";

// Lazy worker constructor — Vite ?worker import
import FloodFillWorker from "../workers/flood-fill.worker?worker";

const FILL_TIMEOUT_MS = 10_000;
/** Below this pixel count, use sync fill to avoid Worker overhead */
const SYNC_THRESHOLD = 10_000;

interface CanvasFillResult {
  levelData: Uint8Array;
  changed: Uint32Array;
  truncated: boolean;
}

interface GlazeFillResult {
  pixelCandidateOverrideMap: Uint8Array;
  changed: Uint32Array;
  truncated: boolean;
}

interface FloodFillWorkerHandle {
  requestCanvasFill(
    workingData: Uint8Array,
    seedX: number,
    seedY: number,
    targetLevel: number,
    width: number,
    height: number,
  ): Promise<CanvasFillResult>;
  requestGlazeFill(
    levelData: Uint8Array,
    pixelCandidateOverrideMap: Uint8Array,
    seedX: number,
    seedY: number,
    targetColorOverrideValue: number,
    width: number,
    height: number,
  ): Promise<GlazeFillResult>;
}

export function useFloodFillWorker(): FloodFillWorkerHandle {
  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);
  // Track whether worker creation was attempted and failed (skip retries)
  const workerFailedRef = useRef(false);

  const resetWorker = useCallback((target: Worker) => {
    if (workerRef.current === target) {
      target.terminate();
      workerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  /** Lazily create the worker. Returns null if creation fails. */
  function getWorker(): Worker | null {
    if (workerRef.current) return workerRef.current;
    if (workerFailedRef.current) return null;
    try {
      workerRef.current = new FloodFillWorker();
      return workerRef.current;
    } catch {
      workerFailedRef.current = true;
      return null;
    }
  }

  const requestCanvasFill = useCallback(
    (
      workingData: Uint8Array,
      seedX: number,
      seedY: number,
      targetLevel: number,
      width: number,
      height: number,
    ): Promise<CanvasFillResult> => {
      const perfStart = startDebugPerf();
      const pixels = width * height;
      // Use sync fallback for small canvases or when Worker unavailable
      const worker = pixels < SYNC_THRESHOLD ? null : getWorker();
      if (!worker) {
        const result = floodFill(workingData, seedX, seedY, targetLevel, width, height);
        const changed = result ? result.changed : new Uint32Array(0);
        const truncated = result ? result.truncated : false;
        recordDebugPerf("flood-fill:canvas:sync", perfStart, { w: width, h: height, pixels, changed: changed.length, truncated });
        return Promise.resolve({
          levelData: workingData,
          changed,
          truncated,
        });
      }

      const id = ++reqIdRef.current;
      const dataCopy = new Uint8Array(workingData);
      const req: FloodFillWorkerRequest = { id, kind: "canvas", levelData: dataCopy, seedX, seedY, targetLevel, width, height };

      return new Promise<CanvasFillResult>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timeout);
          worker.removeEventListener("message", handler);
          worker.removeEventListener("error", errHandler);
        };

        const timeout = setTimeout(() => {
          cleanup();
          resetWorker(worker);
          recordDebugPerf("flood-fill:canvas:worker", perfStart, { status: "timeout", w: width, h: height, pixels });
          reject(new Error("Flood fill timed out"));
        }, FILL_TIMEOUT_MS);

        const errHandler = (ev: ErrorEvent) => {
          cleanup();
          resetWorker(worker);
          recordDebugPerf("flood-fill:canvas:worker", perfStart, { status: "error", w: width, h: height, pixels });
          reject(new Error(ev.message || "Worker error"));
        };

        const handler = (e: MessageEvent<FloodFillWorkerResponse>) => {
          if (e.data.id !== id) return;
          cleanup();
          recordDebugPerf("flood-fill:canvas:worker", perfStart, {
            status: "ok",
            w: width,
            h: height,
            pixels,
            changed: e.data.changed.length,
            truncated: e.data.truncated,
          });
          resolve({
            levelData: e.data.levelData,
            changed: e.data.changed,
            truncated: e.data.truncated,
          });
        };

        worker.addEventListener("message", handler);
        worker.addEventListener("error", errHandler);
        worker.postMessage(req, [dataCopy.buffer as ArrayBuffer]);
      });
    },
    [resetWorker],
  );

  const requestGlazeFill = useCallback(
    (
      levelData: Uint8Array,
      pixelCandidateOverrideMap: Uint8Array,
      seedX: number,
      seedY: number,
      targetColorOverrideValue: number,
      width: number,
      height: number,
    ): Promise<GlazeFillResult> => {
      const perfStart = startDebugPerf();
      const pixels = width * height;
      // Use sync fallback for small canvases or when Worker unavailable
      const worker = pixels < SYNC_THRESHOLD ? null : getWorker();
      if (!worker) {
        const result = glazeFloodFill(levelData, pixelCandidateOverrideMap, seedX, seedY, targetColorOverrideValue, width, height);
        const changed = result ? result.changed : new Uint32Array(0);
        const truncated = result ? result.truncated : false;
        recordDebugPerf("flood-fill:glaze:sync", perfStart, { w: width, h: height, pixels, changed: changed.length, truncated });
        return Promise.resolve({
          pixelCandidateOverrideMap,
          changed,
          truncated,
        });
      }

      const id = ++reqIdRef.current;
      const dataCopy = new Uint8Array(levelData);
      const overrideMapCopy = new Uint8Array(pixelCandidateOverrideMap);
      const req: FloodFillWorkerRequest = {
        id,
        kind: "glaze",
        levelData: dataCopy,
        seedX,
        seedY,
        targetLevel: 0,
        width,
        height,
        pixelCandidateOverrideMap: overrideMapCopy,
        targetColorOverrideValue,
      };

      return new Promise<GlazeFillResult>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timeout);
          worker.removeEventListener("message", handler);
          worker.removeEventListener("error", errHandler);
        };

        const timeout = setTimeout(() => {
          cleanup();
          resetWorker(worker);
          recordDebugPerf("flood-fill:glaze:worker", perfStart, { status: "timeout", w: width, h: height, pixels });
          reject(new Error("Glaze fill timed out"));
        }, FILL_TIMEOUT_MS);

        const errHandler = (ev: ErrorEvent) => {
          cleanup();
          resetWorker(worker);
          recordDebugPerf("flood-fill:glaze:worker", perfStart, { status: "error", w: width, h: height, pixels });
          reject(new Error(ev.message || "Worker error"));
        };

        const handler = (e: MessageEvent<FloodFillWorkerResponse>) => {
          if (e.data.id !== id) return;
          cleanup();
          recordDebugPerf("flood-fill:glaze:worker", perfStart, {
            status: "ok",
            w: width,
            h: height,
            pixels,
            changed: e.data.changed.length,
            truncated: e.data.truncated,
          });
          resolve({
            pixelCandidateOverrideMap: e.data.pixelCandidateOverrideMap!,
            changed: e.data.changed,
            truncated: e.data.truncated,
          });
        };

        worker.addEventListener("message", handler);
        worker.addEventListener("error", errHandler);
        worker.postMessage(req, [dataCopy.buffer as ArrayBuffer, overrideMapCopy.buffer as ArrayBuffer]);
      });
    },
    [resetWorker],
  );

  return { requestCanvasFill, requestGlazeFill };
}
