/* ═══════════════════════════════════════════
   SHARED TYPES
   ═══════════════════════════════════════════ */

import type React from "react";
import type { RingBuffer } from "./utils/ring-buffer";

export type MapMode = "diversity" | "isolation" | "boundaryDistance" | "gradient" | "region" | "levelTone" | "colorLuma";

export interface AnalysisPixelMaps {
  neighborIsolation: Float32Array;
  boundaryDistance: Float32Array;
  gradientAngle: Float32Array;
  gradientMagnitude: Float32Array;
  regionId: Int32Array;
  edgeMask: Uint8Array;
  levelTone: Float32Array;
  localDiversity: Float32Array;
  width: number;
  height: number;
}

export interface Diff {
  indices: Uint32Array;
  oldLevelValues: Uint8Array;
  newLevelValues: Uint8Array;
  /** Optional pixel candidate override diff (same indices array). Undefined for Canvas-tab-only strokes. */
  oldPixelCandidateOverrideValues?: Uint8Array;
  newPixelCandidateOverrideValues?: Uint8Array;
}

export interface CompressedDiff {
  /** RLE-encoded index runs: [start0, len0, start1, len1, ...] */
  indexRuns: Uint32Array;
  oldLevelValues: Uint8Array;
  newLevelValues: Uint8Array;
  oldPixelCandidateOverrideValues?: Uint8Array;
  newPixelCandidateOverrideValues?: Uint8Array;
}

export interface CanvasData {
  width: number;
  height: number;
  levelData: Uint8Array;
  /** Per-pixel color variant override. 0=default(candidateIndexByLevel[]), 1+=specific variant (1-indexed). */
  pixelCandidateOverrideMap: Uint8Array;
}

export interface AppState {
  canvasData: CanvasData;
  undoStack: RingBuffer<CompressedDiff>;
  redoStack: RingBuffer<CompressedDiff>;
  levelHistogram: number[];
}

export type CanvasAction =
  | { type: "stroke_end"; finalLevelData: Uint8Array; finalPixelCandidateOverrideMap?: Uint8Array; diff: Diff | null }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "load_image"; width: number; height: number; levelData: Uint8Array; pixelCandidateOverrideMap?: Uint8Array }
  | { type: "clear" }
  | { type: "new_canvas"; width: number; height: number }
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
  workingData: Uint8Array;
  beforeData: Uint8Array;
  params: StrokeParams;
  shapeStart: Point;
  prevShapeBBox: DirtyRect | null;
  fillChangedIndices: Uint32Array | null;
}

export interface ImageRenderCache {
  sourceImageData: ImageData | null;
  previewImageData: ImageData | null;
  /** Cached Uint32Array views of source/preview data buffers. Recreated when ImageData changes. */
  sourcePixels32: Uint32Array | null;
  previewPixels32: Uint32Array | null;
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
  displayWidth: number;
  displayHeight: number;
  canvasTransform: React.CSSProperties;
  canvasCursor: string;
}

export interface PanZoomHandlers {
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  scheduleCursorRedrawRef: React.MutableRefObject<(() => void) | null>;
  spaceRef: React.MutableRefObject<boolean>;
  panningRef: React.MutableRefObject<boolean>;
  startPan: (e: React.PointerEvent) => void;
  handleMiddleDown: (e: React.PointerEvent) => void;
  movePan: (e: React.PointerEvent) => void;
  endPan: () => void;
}

export interface DrawingHandlers {
  onPreviewPointerDown: (e: React.PointerEvent) => void;
  onPreviewPointerMove: (e: React.PointerEvent) => void;
  onUp: () => void;
  onPreviewPointerLeave: (e: React.PointerEvent) => void;
  trackPreviewCursor: (e: React.PointerEvent) => void;
  clearPreviewCursor: () => void;
}

export interface SaveActions {
  saveColor: (ref: React.RefObject<HTMLCanvasElement | null>, name: string) => void;
  saveColorWithLUT: (lut: [number, number, number][], name: string) => void;
  saveGlaze: (name: string) => void;
  shareColor: (ref: React.RefObject<HTMLCanvasElement | null>, name: string) => void;
  shareGlaze: (name: string) => void;
}
