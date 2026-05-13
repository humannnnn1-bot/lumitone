/* ═══════════════════════════════════════════
   STROKE MANAGER — pure functions extracted
   from useCanvasDrawing for testability.
   No React, no DOM, no refs.
   ═══════════════════════════════════════════ */

import { isShapeTool } from "../constants";
import type { ToolId } from "../constants";
import { BRUSH_SHAPE_PAINTERS, paintBrush, paintBrushLine } from "../drawing/paint";
import { unionBBox, restoreRect } from "../drawing/dirty-rect";
import { brushMaskBBox, getBrushMask, shapeMaskBBox } from "../drawing/brush-mask";
import { computeDiff, buildDiffFromFill } from "../state/undo-diff";
import type { DirtyRect, Point, StrokeState, Diff } from "../types";

/* ── Buffer pool management ────────────────── */

export interface BufferPool {
  beforeData: Uint8Array | null;
  workingData: Uint8Array | null;
  size: number;
}

/** Allocate or reuse before/working buffers from pool. Copies `levelData` into both. */
export function allocateStrokeBuffers(pool: BufferPool, levelData: Uint8Array): { beforeData: Uint8Array; workingData: Uint8Array } {
  const n = levelData.length;
  if (!pool.beforeData || !pool.workingData || pool.size !== n) {
    pool.beforeData = new Uint8Array(n);
    pool.workingData = new Uint8Array(n);
    pool.size = n;
  }
  pool.beforeData.set(levelData);
  pool.workingData.set(levelData);
  return { beforeData: pool.beforeData, workingData: pool.workingData };
}

/* ── Stroke state creation ─────────────────── */

/** Create a new StrokeState for the given tool/params/position. */
export function createStrokeState(
  workingData: Uint8Array,
  beforeData: Uint8Array,
  tool: ToolId,
  brushLevel: number,
  brushSize: number,
  startPos: Point,
): StrokeState {
  return {
    workingData,
    beforeData,
    params: { tool, brushLevel, brushSize },
    shapeStart: startPos,
    prevShapeBBox: null,
    fillChangedIndices: null,
  };
}

/* ── Brush stroke application ──────────────── */

/** Apply brush/eraser paint between two points. Returns dirty rect. */
export function applyBrushStroke(
  workingData: Uint8Array,
  last: Point,
  current: Point,
  brushSize: number,
  level: number,
  w: number,
  h: number,
): DirtyRect | null {
  const mask = getBrushMask(brushSize);
  paintBrushLine(workingData, last.x, last.y, current.x, current.y, mask, level, w, h);
  return brushMaskBBox(
    [
      [last.x, last.y],
      [current.x, current.y],
    ],
    mask,
    w,
    h,
  );
}

/** Apply initial brush dot at a single point. Returns dirty rect. */
export function applyBrushDot(
  workingData: Uint8Array,
  pos: Point,
  brushSize: number,
  level: number,
  w: number,
  h: number,
): DirtyRect | null {
  const mask = getBrushMask(brushSize);
  paintBrush(workingData, pos.x, pos.y, mask, level, w, h);
  return brushMaskBBox([[pos.x, pos.y]], mask, w, h);
}

/* ── Shape stroke application ──────────────── */

/** Apply shape tool stroke with restore from beforeData. Returns new bboxes. */
export function applyShapeStroke(
  workingData: Uint8Array,
  beforeData: Uint8Array,
  tool: string,
  origin: Point,
  current: Point,
  brushSize: number,
  level: number,
  w: number,
  h: number,
  prevBBox: DirtyRect | null,
): { shapeBBox: DirtyRect | null; dirtyBBox: DirtyRect | null } {
  const mask = getBrushMask(brushSize);
  const newBB = shapeMaskBBox(origin.x, origin.y, current.x, current.y, mask, w, h);
  const dirtyBB = unionBBox(prevBBox, newBB);
  if (dirtyBB) restoreRect(workingData, beforeData, w, dirtyBB);
  BRUSH_SHAPE_PAINTERS[tool]?.(workingData, origin.x, origin.y, current.x, current.y, mask, level, w, h);
  return { shapeBBox: newBB, dirtyBBox: dirtyBB };
}

/** Apply initial shape dot (origin === current). Returns bbox. */
export function applyShapeDot(
  workingData: Uint8Array,
  tool: string,
  pos: Point,
  brushSize: number,
  level: number,
  w: number,
  h: number,
): DirtyRect | null {
  const mask = getBrushMask(brushSize);
  BRUSH_SHAPE_PAINTERS[tool]?.(workingData, pos.x, pos.y, pos.x, pos.y, mask, level, w, h);
  return shapeMaskBBox(pos.x, pos.y, pos.x, pos.y, mask, w, h);
}

/* ── Stroke result computation ─────────────── */

/** Resolve effective paint level for a tool. */
export function resolveLevel(tool: ToolId, brushLevel: number): number {
  return tool === "eraser" ? 0 : brushLevel;
}

/** Determine if the tool is a shape tool. Re-export for convenience. */
export { isShapeTool };

/** Compute the diff from a completed stroke. Returns null if no changes. */
export function computeStrokeResult(beforeData: Uint8Array, workingData: Uint8Array, fillChangedIndices: Uint32Array | null): Diff | null {
  if (fillChangedIndices) {
    return buildDiffFromFill(beforeData, workingData, fillChangedIndices);
  }
  return computeDiff(beforeData, workingData);
}
