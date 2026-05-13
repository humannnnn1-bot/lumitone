/* ═══════════════════════════════════════════
   DRAWING BASE UTILITIES
   Shared pure functions used by both useCanvasDrawing
   and useGlazeDrawing to avoid code duplication.
   ═══════════════════════════════════════════ */

import { LEVEL_MASK } from "../constants";
import { LEVEL_INFO } from "../color-engine";
import type { CanvasData, Point } from "../types";
import { applyStatusText, type StatusTextLike } from "../utils/status-display";

type CanvasRect = { left: number; top: number; width: number; height: number };

function canvasPosFromRect(
  e: { clientX: number; clientY: number },
  r: CanvasRect,
  zoom: number,
  pan: { x: number; y: number },
  canvasData: CanvasData,
): Point {
  const rx = (e.clientX - r.left) / r.width,
    ry = (e.clientY - r.top) / r.height;
  const vx = (rx - 0.5) / zoom + 0.5 - pan.x / canvasData.width;
  const vy = (ry - 0.5) / zoom + 0.5 - pan.y / canvasData.height;
  return {
    x: Math.floor(vx * canvasData.width),
    y: Math.floor(vy * canvasData.height),
  };
}

/**
 * Convert a pointer event's client coordinates to canvas pixel coordinates,
 * accounting for zoom, pan, and canvas dimensions.
 */
export function canvasPos(
  e: { clientX: number; clientY: number },
  refEl: HTMLCanvasElement | null,
  zoom: number,
  pan: { x: number; y: number },
  canvasData: CanvasData,
): Point {
  if (!refEl) return { x: 0, y: 0 };
  const r = refEl.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return { x: -1, y: -1 };
  const pos = canvasPosFromRect(e, r, zoom, pan, canvasData);
  return {
    x: Math.max(0, Math.min(canvasData.width - 1, pos.x)),
    y: Math.max(0, Math.min(canvasData.height - 1, pos.y)),
  };
}

/**
 * Convert pointer coordinates to canvas pixel coordinates without clamping.
 * Use this for pointer-stream drawing so samples outside the canvas remain in
 * canvas space instead of being smeared onto the nearest edge.
 */
export function canvasPosUnclamped(
  e: { clientX: number; clientY: number },
  refEl: HTMLCanvasElement | null,
  zoom: number,
  pan: { x: number; y: number },
  canvasData: CanvasData,
): Point {
  if (!refEl) return { x: 0, y: 0 };
  const r = refEl.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return { x: -1, y: -1 };
  return canvasPosFromRect(e, r, zoom, pan, canvasData);
}

export function isCanvasPointInBounds(pos: Point, canvasData: CanvasData): boolean {
  return pos.x >= 0 && pos.x < canvasData.width && pos.y >= 0 && pos.y < canvasData.height;
}

/**
 * Attempt to set pointer capture on the event target.
 * Silently ignores failures (browser inconsistencies).
 */
export function trySetPointerCapture(e: React.PointerEvent): void {
  if ((e.target as HTMLElement).setPointerCapture) {
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Check if the pointer event should initiate panning instead of drawing.
 * Returns true if pan was started (caller should return early).
 */
export function tryStartPan(
  e: React.PointerEvent,
  spaceRef: React.MutableRefObject<boolean>,
  startPanRef: React.MutableRefObject<(e: React.PointerEvent) => void>,
): boolean {
  if (e.button === 1) {
    startPanRef.current(e);
    return true;
  }
  if (spaceRef.current) {
    startPanRef.current(e);
    return true;
  }
  return false;
}

/** Refs needed by the shared cPos / updateStatus helpers. */
export interface DrawingRefs {
  zoomRef: React.MutableRefObject<number>;
  panRef: React.MutableRefObject<{ x: number; y: number }>;
  canvasDataRef: React.MutableRefObject<CanvasData>;
}

/**
 * Compute canvas-pixel position from a pointer event using shared refs.
 * `refEl` is the canvas element used for bounding-rect lookup.
 */
export function canvasPosFromRefs(e: React.PointerEvent, refEl: HTMLCanvasElement | null, refs: DrawingRefs): Point {
  return canvasPos(e, refEl, refs.zoomRef.current, refs.panRef.current, refs.canvasDataRef.current);
}

/**
 * Shared status-bar update logic.
 * Computes the canvas position, performs bounds-checking, resolves the
 * pixel level, then delegates to `formatText` for mode-specific text.
 *
 * @param formatText Receives (pos, level index, LEVEL_INFO entry, pixel index)
 *                   and returns the status text to display.
 */
export function updateStatusBase(
  e: React.PointerEvent,
  statusEl: HTMLDivElement | null,
  refEl: HTMLCanvasElement | null,
  refs: DrawingRefs,
  dataSource: Uint8Array,
  formatText: (pos: Point, lv: number, info: { name: string }, idx: number) => StatusTextLike,
): void {
  if (!statusEl) return;
  const cv = refs.canvasDataRef.current;
  const pos = canvasPosUnclamped(e, refEl, refs.zoomRef.current, refs.panRef.current, cv);
  if (pos.x < 0 || pos.x >= cv.width || pos.y < 0 || pos.y >= cv.height) {
    statusEl.textContent = "\u2014";
    statusEl.title = "";
    return;
  }
  const idx = pos.y * cv.width + pos.x;
  const lv = dataSource[idx] & LEVEL_MASK;
  const info = LEVEL_INFO[lv];
  applyStatusText(statusEl, formatText(pos, lv, info, idx));
}
