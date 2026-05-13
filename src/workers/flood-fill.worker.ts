/**
 * Web Worker for flood fill operations.
 * Offloads scanline flood fill from the main thread for non-blocking UI.
 */
import { floodFill, glazeFloodFill } from "../drawing/flood-fill";

interface FloodFillWorkerRequestBase {
  id: number;
  levelData: Uint8Array;
  seedX: number;
  seedY: number;
  width: number;
  height: number;
}

export type FloodFillWorkerRequest =
  | (FloodFillWorkerRequestBase & {
      kind: "canvas";
      targetLevel: number;
    })
  | (FloodFillWorkerRequestBase & {
      kind: "glaze";
      pixelCandidateOverrideMap: Uint8Array;
      targetPixelCandidateOverrideValue: number;
    });

export interface FloodFillWorkerResponse {
  id: number;
  levelData: Uint8Array;
  pixelCandidateOverrideMap?: Uint8Array;
  changedIndices: Uint32Array;
  truncated: boolean;
}

self.onmessage = (e: MessageEvent<FloodFillWorkerRequest>) => {
  const { id, kind, levelData, seedX, seedY, width, height } = e.data;

  if (kind === "glaze") {
    const { pixelCandidateOverrideMap, targetPixelCandidateOverrideValue } = e.data;
    const result = glazeFloodFill(levelData, pixelCandidateOverrideMap, seedX, seedY, targetPixelCandidateOverrideValue, width, height);
    const changedIndices = result ? result.changedIndices : new Uint32Array(0);
    const truncated = result ? result.truncated : false;
    const resp: FloodFillWorkerResponse = { id, levelData, pixelCandidateOverrideMap, changedIndices, truncated };
    const transfer: Transferable[] = [
      levelData.buffer as ArrayBuffer,
      pixelCandidateOverrideMap.buffer as ArrayBuffer,
      changedIndices.buffer as ArrayBuffer,
    ];
    (self as unknown as Worker).postMessage(resp, transfer);
  } else {
    const { targetLevel } = e.data;
    const result = floodFill(levelData, seedX, seedY, targetLevel, width, height);
    const changedIndices = result ? result.changedIndices : new Uint32Array(0);
    const truncated = result ? result.truncated : false;
    const resp: FloodFillWorkerResponse = { id, levelData, changedIndices, truncated };
    const transfer: Transferable[] = [levelData.buffer as ArrayBuffer, changedIndices.buffer as ArrayBuffer];
    (self as unknown as Worker).postMessage(resp, transfer);
  }
};
