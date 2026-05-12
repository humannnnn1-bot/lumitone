/* ═══════════════════════════════════════════
   SHARED TYPES
   ═══════════════════════════════════════════ */

import type React from "react";
import type { ExportScale } from "./constants";
import type { RingBuffer } from "./utils/ring-buffer";

export type MapMode = "entropy" | "noise" | "boundaryDistance" | "gradient" | "region" | "luminance" | "colorLuma";

export interface AnalysisPixelMaps {
  noise: Float32Array;
  boundaryDistance: Float32Array;
  gradientAngle: Float32Array;
  gradientMagnitude: Float32Array;
  regionId: Int32Array;
  isEdge: Uint8Array;
  levelNorm: Float32Array;
  localDiversity: Float32Array;
  w: number;
  h: number;
}

export interface Diff {
  indices: Uint32Array;
  oldValues: Uint8Array;
  newValues: Uint8Array;
  /** Optional colorMap diff (same indices array). Undefined for Canvas-tab-only strokes. */
  oldColorMapValues?: Uint8Array;
  newColorMapValues?: Uint8Array;
}

export interface CompressedDiff {
  /** RLE-encoded index runs: [start0, len0, start1, len1, ...] */
  runs: Uint32Array;
  oldValues: Uint8Array;
  newValues: Uint8Array;
  oldColorMapValues?: Uint8Array;
  newColorMapValues?: Uint8Array;
}

export interface CanvasData {
  w: number;
  h: number;
  data: Uint8Array;
  /** Per-pixel color variant override. 0=default(colorChoiceIndices[]), 1+=specific variant (1-indexed). */
  colorMap: Uint8Array;
}

export interface AppState {
  cvs: CanvasData;
  undoStack: RingBuffer<CompressedDiff>;
  redoStack: RingBuffer<CompressedDiff>;
  hist: number[];
}

export type CanvasAction =
  | { type: "stroke_end"; finalData: Uint8Array; finalColorMap?: Uint8Array; diff: Diff | null }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "load_image"; w: number; h: number; data: Uint8Array; colorMap?: Uint8Array }
  | { type: "clear" }
  | { type: "new_canvas"; w: number; h: number }
  | { type: "glaze_clear" };

export interface DirtyRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

interface StrokeParams {
  tool: import("./constants").ToolId;
  brushLevel: number;
  brushSize: number;
}

export interface StrokeState {
  buf: Uint8Array;
  pre: Uint8Array;
  params: StrokeParams;
  shapeStart: Point;
  prevShapeBBox: DirtyRect | null;
  fillChanged: Uint32Array | null;
}

export interface ImgCache {
  src: ImageData | null;
  prv: ImageData | null;
  /** Cached Uint32Array views of src/prv data buffers. Recreated when ImageData changes. */
  s32: Uint32Array | null;
  p32: Uint32Array | null;
}

export interface ToolState {
  tool: import("./constants").ToolId;
  setTool: React.Dispatch<React.SetStateAction<import("./constants").ToolId>>;
  brushLevel: number;
  setBrushLevel: React.Dispatch<React.SetStateAction<number>>;
  brushSize: number;
  setBrushSize: React.Dispatch<React.SetStateAction<number>>;
}

export interface ViewState {
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  displayW: number;
  displayH: number;
  canvasTransform: React.CSSProperties;
  canvasCursor: string;
}

export interface PanZoomHandlers {
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  schedCursorRef: React.MutableRefObject<(() => void) | null>;
  spaceRef: React.MutableRefObject<boolean>;
  panningRef: React.MutableRefObject<boolean>;
  startPan: (e: React.PointerEvent) => void;
  handleMiddleDown: (e: React.PointerEvent) => void;
  movePan: (e: React.PointerEvent) => void;
  endPan: () => void;
}

export interface DrawingHandlers {
  onDownPrv: (e: React.PointerEvent) => void;
  onMovePrv: (e: React.PointerEvent) => void;
  onUp: () => void;
  onPointerLeavePrv: (e: React.PointerEvent) => void;
  trackCursorPrv: (e: React.PointerEvent) => void;
  clearCursorPrv: () => void;
}

export interface SaveActions {
  saveColor: (ref: React.RefObject<HTMLCanvasElement | null>, name: string, scale?: ExportScale) => void;
  saveColorWithLUT: (lut: [number, number, number][], name: string, scale?: ExportScale) => void;
  saveGlaze: (name: string, scale?: ExportScale) => void;
  shareColor: (ref: React.RefObject<HTMLCanvasElement | null>, name: string) => void;
  shareGlaze: (name: string) => void;
}
