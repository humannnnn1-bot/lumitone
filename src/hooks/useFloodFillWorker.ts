/**
 * Hook that manages a Web Worker for flood fill operations.
 * Provides async fill functions that offload work from the main thread.
 * Falls back to synchronous execution if Worker creation fails (e.g. test env).
 */
import { useRef, useEffect, useCallback } from "react";
import { floodFill, glazeFloodFill } from "../flood-fill";
import type { FloodFillWorkerRequest, FloodFillWorkerResponse } from "../workers/flood-fill.worker";

// Lazy worker constructor — Vite ?worker import
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite worker import
import FloodFillWorker from "../workers/flood-fill.worker?worker";

const FILL_TIMEOUT_MS = 10_000;
/** Below this pixel count, use sync fill to avoid Worker overhead */
const SYNC_THRESHOLD = 10_000;

export interface CanvasFillResult {
  data: Uint8Array;
  changed: Uint32Array;
  truncated: boolean;
}

export interface GlazeFillResult {
  colorMap: Uint8Array;
  changed: Uint32Array;
  truncated: boolean;
}

export interface FloodFillWorkerHandle {
  requestCanvasFill(buf: Uint8Array, sx: number, sy: number, newVal: number, w: number, h: number): Promise<CanvasFillResult>;
  requestGlazeFill(data: Uint8Array, colorMap: Uint8Array, sx: number, sy: number, newCmVal: number, w: number, h: number): Promise<GlazeFillResult>;
}

export function useFloodFillWorker(): FloodFillWorkerHandle {
  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);
  // Track whether worker creation was attempted and failed (skip retries)
  const workerFailedRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => { workerRef.current?.terminate(); workerRef.current = null; };
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
    (buf: Uint8Array, sx: number, sy: number, newVal: number, w: number, h: number): Promise<CanvasFillResult> => {
      // Use sync fallback for small canvases or when Worker unavailable
      const worker = w * h < SYNC_THRESHOLD ? null : getWorker();
      if (!worker) {
        const result = floodFill(buf, sx, sy, newVal, w, h);
        return Promise.resolve({
          data: buf,
          changed: result ? result.changed : new Uint32Array(0),
          truncated: result ? result.truncated : false,
        });
      }

      const id = ++reqIdRef.current;
      const dataCopy = new Uint8Array(buf);
      const req: FloodFillWorkerRequest = { id, kind: "canvas", data: dataCopy, sx, sy, newVal, w, h };

      return new Promise<CanvasFillResult>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timeout);
          worker.removeEventListener("message", handler);
          worker.removeEventListener("error", errHandler);
        };

        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Flood fill timed out"));
        }, FILL_TIMEOUT_MS);

        const errHandler = (ev: ErrorEvent) => {
          cleanup();
          reject(new Error(ev.message || "Worker error"));
        };

        const handler = (e: MessageEvent<FloodFillWorkerResponse>) => {
          if (e.data.id !== id) return;
          cleanup();
          resolve({
            data: e.data.data,
            changed: e.data.changed,
            truncated: e.data.truncated,
          });
        };

        worker.addEventListener("message", handler);
        worker.addEventListener("error", errHandler);
        worker.postMessage(req, [dataCopy.buffer as ArrayBuffer]);
      });
    },
    [],
  );

  const requestGlazeFill = useCallback(
    (data: Uint8Array, colorMap: Uint8Array, sx: number, sy: number, newCmVal: number, w: number, h: number): Promise<GlazeFillResult> => {
      // Use sync fallback for small canvases or when Worker unavailable
      const worker = w * h < SYNC_THRESHOLD ? null : getWorker();
      if (!worker) {
        const result = glazeFloodFill(data, colorMap, sx, sy, newCmVal, w, h);
        return Promise.resolve({
          colorMap,
          changed: result ? result.changed : new Uint32Array(0),
          truncated: result ? result.truncated : false,
        });
      }

      const id = ++reqIdRef.current;
      const dataCopy = new Uint8Array(data);
      const cmCopy = new Uint8Array(colorMap);
      const req: FloodFillWorkerRequest = {
        id, kind: "glaze", data: dataCopy, sx, sy,
        newVal: 0, w, h, colorMap: cmCopy, newCmVal,
      };

      return new Promise<GlazeFillResult>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timeout);
          worker.removeEventListener("message", handler);
          worker.removeEventListener("error", errHandler);
        };

        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Glaze fill timed out"));
        }, FILL_TIMEOUT_MS);

        const errHandler = (ev: ErrorEvent) => {
          cleanup();
          reject(new Error(ev.message || "Worker error"));
        };

        const handler = (e: MessageEvent<FloodFillWorkerResponse>) => {
          if (e.data.id !== id) return;
          cleanup();
          resolve({
            colorMap: e.data.colorMap!,
            changed: e.data.changed,
            truncated: e.data.truncated,
          });
        };

        worker.addEventListener("message", handler);
        worker.addEventListener("error", errHandler);
        worker.postMessage(req, [dataCopy.buffer as ArrayBuffer, cmCopy.buffer as ArrayBuffer]);
      });
    },
    [],
  );

  return { requestCanvasFill, requestGlazeFill };
}
