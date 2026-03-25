/**
 * Web Worker for flood fill operations.
 * Offloads scanline flood fill from the main thread for non-blocking UI.
 */
import { floodFill, glazeFloodFill } from "../flood-fill";

export interface FloodFillWorkerRequest {
  id: number;
  kind: "canvas" | "glaze";
  data: Uint8Array;
  sx: number;
  sy: number;
  newVal: number;
  w: number;
  h: number;
  /** Only for kind === "glaze" */
  colorMap?: Uint8Array;
  /** Only for kind === "glaze" */
  newCmVal?: number;
}

export interface FloodFillWorkerResponse {
  id: number;
  data: Uint8Array;
  colorMap?: Uint8Array;
  changed: Uint32Array;
  truncated: boolean;
}

self.onmessage = (e: MessageEvent<FloodFillWorkerRequest>) => {
  const { id, kind, data, sx, sy, newVal, w, h, colorMap, newCmVal } = e.data;

  if (kind === "glaze" && colorMap != null && newCmVal != null) {
    const result = glazeFloodFill(data, colorMap, sx, sy, newCmVal, w, h);
    const changed = result ? result.changed : new Uint32Array(0);
    const truncated = result ? result.truncated : false;
    const resp: FloodFillWorkerResponse = { id, data, colorMap, changed, truncated };
    const transfer: Transferable[] = [
      data.buffer as ArrayBuffer,
      colorMap.buffer as ArrayBuffer,
      changed.buffer as ArrayBuffer,
    ];
    (self as unknown as Worker).postMessage(resp, transfer);
  } else {
    const result = floodFill(data, sx, sy, newVal, w, h);
    const changed = result ? result.changed : new Uint32Array(0);
    const truncated = result ? result.truncated : false;
    const resp: FloodFillWorkerResponse = { id, data, changed, truncated };
    const transfer: Transferable[] = [
      data.buffer as ArrayBuffer,
      changed.buffer as ArrayBuffer,
    ];
    (self as unknown as Worker).postMessage(resp, transfer);
  }
};
