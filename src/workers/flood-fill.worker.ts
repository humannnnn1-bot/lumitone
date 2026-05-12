/**
 * Web Worker for flood fill operations.
 * Offloads scanline flood fill from the main thread for non-blocking UI.
 */
import { floodFill, glazeFloodFill } from "../drawing/flood-fill";

export interface FloodFillWorkerRequest {
  id: number;
  kind: "canvas" | "glaze";
  levelData: Uint8Array;
  seedX: number;
  seedY: number;
  targetLevel: number;
  width: number;
  height: number;
  /** Only for kind === "glaze" */
  pixelCandidateOverrideMap?: Uint8Array;
  /** Only for kind === "glaze" */
  targetColorOverrideValue?: number;
}

export interface FloodFillWorkerResponse {
  id: number;
  levelData: Uint8Array;
  pixelCandidateOverrideMap?: Uint8Array;
  changed: Uint32Array;
  truncated: boolean;
}

self.onmessage = (e: MessageEvent<FloodFillWorkerRequest>) => {
  const { id, kind, levelData, seedX, seedY, targetLevel, width, height, pixelCandidateOverrideMap, targetColorOverrideValue } = e.data;

  if (kind === "glaze" && pixelCandidateOverrideMap != null && targetColorOverrideValue != null) {
    const result = glazeFloodFill(levelData, pixelCandidateOverrideMap, seedX, seedY, targetColorOverrideValue, width, height);
    const changed = result ? result.changed : new Uint32Array(0);
    const truncated = result ? result.truncated : false;
    const resp: FloodFillWorkerResponse = { id, levelData, pixelCandidateOverrideMap, changed, truncated };
    const transfer: Transferable[] = [
      levelData.buffer as ArrayBuffer,
      pixelCandidateOverrideMap.buffer as ArrayBuffer,
      changed.buffer as ArrayBuffer,
    ];
    (self as unknown as Worker).postMessage(resp, transfer);
  } else {
    const result = floodFill(levelData, seedX, seedY, targetLevel, width, height);
    const changed = result ? result.changed : new Uint32Array(0);
    const truncated = result ? result.truncated : false;
    const resp: FloodFillWorkerResponse = { id, levelData, changed, truncated };
    const transfer: Transferable[] = [levelData.buffer as ArrayBuffer, changed.buffer as ArrayBuffer];
    (self as unknown as Worker).postMessage(resp, transfer);
  }
};
