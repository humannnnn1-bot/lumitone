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
  pre: Uint8Array | null;
  buf: Uint8Array | null;
  size: number;
}

/** Allocate or reuse pre/buf from pool. Copies `data` into both. */
export function allocateStrokeBuffers(pool: BufferPool, data: Uint8Array): { pre: Uint8Array; buf: Uint8Array } {
  const n = data.length;
  if (!pool.pre || !pool.buf || pool.size !== n) {
    pool.pre = new Uint8Array(n);
    pool.buf = new Uint8Array(n);
    pool.size = n;
  }
  pool.pre.set(data);
  pool.buf.set(data);
  return { pre: pool.pre, buf: pool.buf };
}

/* ── Stroke state creation ─────────────────── */

/** Create a new StrokeState for the given tool/params/position. */
export function createStrokeState(
  buf: Uint8Array,
  pre: Uint8Array,
  tool: ToolId,
  brushLevel: number,
  brushSize: number,
  startPos: Point,
): StrokeState {
  return {
    buf,
    pre,
    params: { tool, brushLevel, brushSize },
    shapeStart: startPos,
    prevShapeBBox: null,
    fillChanged: null,
  };
}

/* ── Brush stroke application ──────────────── */

/** Apply brush/eraser paint between two points. Returns dirty rect. */
export function applyBrushStroke(
  buf: Uint8Array,
  last: Point,
  current: Point,
  brushSize: number,
  level: number,
  w: number,
  h: number,
): DirtyRect | null {
  const mask = getBrushMask(brushSize);
  paintBrushLine(buf, last.x, last.y, current.x, current.y, mask, level, w, h);
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
export function applyBrushDot(buf: Uint8Array, pos: Point, brushSize: number, level: number, w: number, h: number): DirtyRect | null {
  const mask = getBrushMask(brushSize);
  paintBrush(buf, pos.x, pos.y, mask, level, w, h);
  return brushMaskBBox([[pos.x, pos.y]], mask, w, h);
}

/* ── Shape stroke application ──────────────── */

/** Apply shape tool stroke with restore from pre-buffer. Returns new bboxes. */
export function applyShapeStroke(
  buf: Uint8Array,
  pre: Uint8Array,
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
  if (dirtyBB) restoreRect(buf, pre, w, dirtyBB);
  BRUSH_SHAPE_PAINTERS[tool]?.(buf, origin.x, origin.y, current.x, current.y, mask, level, w, h);
  return { shapeBBox: newBB, dirtyBBox: dirtyBB };
}

/** Apply initial shape dot (origin === current). Returns bbox. */
export function applyShapeDot(
  buf: Uint8Array,
  tool: string,
  pos: Point,
  brushSize: number,
  level: number,
  w: number,
  h: number,
): DirtyRect | null {
  const mask = getBrushMask(brushSize);
  BRUSH_SHAPE_PAINTERS[tool]?.(buf, pos.x, pos.y, pos.x, pos.y, mask, level, w, h);
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
export function computeStrokeResult(pre: Uint8Array, buf: Uint8Array, fillChanged: Uint32Array | null): Diff | null {
  if (fillChanged) {
    return buildDiffFromFill(pre, buf, fillChanged);
  }
  return computeDiff(pre, buf);
}
