import { useRef, useLayoutEffect, useCallback } from "react";
import { GRID_ZOOM_THRESHOLD, isShapeTool } from "../constants";
import type { ToolId } from "../constants";
import { brushMaskHas, getBrushMask } from "../drawing/brush-mask";
import { useRectCache } from "./useRectCache";
import type { CanvasData } from "../types";

interface CursorOverlayRefs {
  zoomRef: React.MutableRefObject<number>;
  panRef: React.MutableRefObject<{ x: number; y: number }>;
  canvasDataRef: React.MutableRefObject<CanvasData>;
  displayWidthRef: React.MutableRefObject<number>;
  displayHeightRef: React.MutableRefObject<number>;
  panningRef: React.MutableRefObject<boolean>;
  brushSizeRef: React.MutableRefObject<number>;
  toolRef: React.MutableRefObject<ToolId>;
}

interface CursorOverlayResult {
  cursorCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  previewCursorRef: React.MutableRefObject<HTMLCanvasElement | null>;
  cursorRafRef: React.MutableRefObject<number | null>;
  scheduleCursorRedrawRef: React.MutableRefObject<(() => void) | null>;
  cursorPosRef: React.MutableRefObject<{ dx: number; dy: number } | null>;
  previewCursorPosRef: React.MutableRefObject<{ dx: number; dy: number } | null>;
  trackCursor: (e: React.PointerEvent) => void;
  clearCursor: () => void;
  trackPreviewCursor: (e: React.PointerEvent) => void;
  clearPreviewCursor: () => void;
  scheduleCursorRedraw: () => void;
}

function snapGridLine(value: number): number {
  return Math.round(value) + 0.5;
}

function snapGridEdge(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function useCursorOverlay(refs: CursorOverlayRefs, statusRef: React.MutableRefObject<HTMLDivElement | null>): CursorOverlayResult {
  const cursorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCursorRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRafRef = useRef<number | null>(null);
  const scheduleCursorRedrawRef = useRef<(() => void) | null>(null);
  const cursorPosRef = useRef<{ dx: number; dy: number } | null>(null);
  const previewCursorPosRef = useRef<{ dx: number; dy: number } | null>(null);
  const prevGridStateRef = useRef<string>("");
  const forceSrcRedrawRef = useRef(false);
  const forcePrvRedrawRef = useRef(false);
  const getCursorRect = useRectCache(cursorCanvasRef);
  const getPreviewCursorRect = useRectCache(previewCursorRef);

  const { zoomRef, panRef, canvasDataRef, displayWidthRef, displayHeightRef, panningRef, brushSizeRef, toolRef } = refs;

  function drawCursorAndGridOn(c: HTMLCanvasElement | null, posRef: React.MutableRefObject<{ dx: number; dy: number } | null>) {
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const z = zoomRef.current,
      cv = canvasDataRef.current,
      p = panRef.current;
    const dW = displayWidthRef.current,
      dH = displayHeightRef.current;
    const pxPerCell = (dW / cv.width) * z;

    if (z >= GRID_ZOOM_THRESHOLD && pxPerCell >= 4) {
      const offsetX = dW * (0.5 - z / 2 + (z * p.x) / cv.width);
      const offsetY = dH * (0.5 - z / 2 + (z * p.y) / cv.height);
      const endY = Math.min(dH, offsetY + cv.height * pxPerCell);
      const endX = Math.min(dW, offsetX + cv.width * pxPerCell);
      const xStart = Math.max(0, Math.ceil(-offsetX / pxPerCell));
      const xEnd = Math.min(cv.width, Math.floor((dW - offsetX) / pxPerCell));
      const yStart = Math.max(0, Math.ceil(-offsetY / pxPerCell));
      const yEnd = Math.min(cv.height, Math.floor((dH - offsetY) / pxPerCell));
      ctx.strokeStyle = "rgba(255,255,255,.08)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const gridTop = snapGridEdge(offsetY, 0, dH);
      const gridBottom = snapGridEdge(endY, 0, dH);
      const gridLeft = snapGridEdge(offsetX, 0, dW);
      const gridRight = snapGridEdge(endX, 0, dW);
      for (let x = xStart; x <= xEnd; x++) {
        const px = snapGridLine(offsetX + x * pxPerCell);
        ctx.moveTo(px, gridTop);
        ctx.lineTo(px, gridBottom);
      }
      for (let y = yStart; y <= yEnd; y++) {
        const py = snapGridLine(offsetY + y * pxPerCell);
        ctx.moveTo(gridLeft, py);
        ctx.lineTo(gridRight, py);
      }
      ctx.stroke();
    }
    const pos = posRef.current;
    if (!pos || panningRef.current) return;
    const curBS = brushSizeRef.current;
    const curTool = toolRef.current;
    // snap cursor to canvas pixel center
    const rx = pos.dx / dW,
      ry = pos.dy / dH;
    const vx = (rx - 0.5) / z + 0.5 - p.x / cv.width;
    const vy = (ry - 0.5) / z + 0.5 - p.y / cv.height;
    const cx = Math.floor(vx * cv.width),
      cy = Math.floor(vy * cv.height);
    const sdx = dW * (((cx + 0.5) / cv.width - 0.5 + p.x / cv.width) * z + 0.5);
    const sdy = dH * (((cy + 0.5) / cv.height - 0.5 + p.y / cv.height) * z + 0.5);
    const brushColor = curTool === "eraser" ? "rgba(255,100,100,.8)" : "rgba(255,255,255,.8)";
    if (curTool !== "fill") {
      const mask = getBrushMask(curBS);
      ctx.beginPath();
      if (mask.size === 1) {
        const dot = mask.offsets[0];
        if (dot) {
          const px = sdx + (dot.dx - 0.5) * pxPerCell;
          const py = sdy + (dot.dy - 0.5) * pxPerCell;
          ctx.rect(px, py, pxPerCell, pxPerCell);
        }
      } else {
        for (const { dx, dy } of mask.offsets) {
          const px = sdx + (dx - 0.5) * pxPerCell;
          const py = sdy + (dy - 0.5) * pxPerCell;
          if (!brushMaskHas(mask, dx, dy - 1)) {
            ctx.moveTo(px, py);
            ctx.lineTo(px + pxPerCell, py);
          }
          if (!brushMaskHas(mask, dx, dy + 1)) {
            ctx.moveTo(px, py + pxPerCell);
            ctx.lineTo(px + pxPerCell, py + pxPerCell);
          }
          if (!brushMaskHas(mask, dx - 1, dy)) {
            ctx.moveTo(px, py);
            ctx.lineTo(px, py + pxPerCell);
          }
          if (!brushMaskHas(mask, dx + 1, dy)) {
            ctx.moveTo(px + pxPerCell, py);
            ctx.lineTo(px + pxPerCell, py + pxPerCell);
          }
        }
      }
      ctx.strokeStyle = "rgba(0,0,0,.5)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (curTool === "fill" || isShapeTool(curTool)) {
      const cs = 8;
      ctx.beginPath();
      ctx.moveTo(sdx - cs, sdy);
      ctx.lineTo(sdx + cs, sdy);
      ctx.moveTo(sdx, sdy - cs);
      ctx.lineTo(sdx, sdy + cs);
      ctx.strokeStyle = "rgba(0,0,0,.5)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = "rgba(200,220,255,.7)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawCursorAndGrid() {
    // Only redraw canvases that have a cursor or need grid update
    const hasSrc = cursorPosRef.current !== null;
    const hasPrv = previewCursorPosRef.current !== null;
    const z = zoomRef.current,
      p = panRef.current,
      cv = canvasDataRef.current;
    const gridKey = `${z}_${p.x}_${p.y}_${cv.width}_${cv.height}_${brushSizeRef.current}_${toolRef.current}_${panningRef.current}`;
    const gridChanged = gridKey !== prevGridStateRef.current;
    if (gridChanged) prevGridStateRef.current = gridKey;
    const forceSrc = forceSrcRedrawRef.current;
    const forcePrv = forcePrvRedrawRef.current;
    forceSrcRedrawRef.current = false;
    forcePrvRedrawRef.current = false;
    // Always redraw if grid changed (zoom/pan), otherwise only the canvas with active cursor
    if (hasSrc || gridChanged || forceSrc) drawCursorAndGridOn(cursorCanvasRef.current, cursorPosRef);
    if (hasPrv || gridChanged || forcePrv) drawCursorAndGridOn(previewCursorRef.current, previewCursorPosRef);
  }

  function scheduleCursorRedraw() {
    if (cursorRafRef.current) return;
    cursorRafRef.current = requestAnimationFrame(() => {
      cursorRafRef.current = null;
      drawCursorAndGrid();
    });
  }

  // Intentionally runs every render (no deps) to keep ref in sync with latest closure
  useLayoutEffect(() => {
    scheduleCursorRedrawRef.current = scheduleCursorRedraw;
  });

  const trackCursor = useCallback(
    (e: React.PointerEvent) => {
      const c = cursorCanvasRef.current;
      if (!c) return;
      const r = getCursorRect();
      cursorPosRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      scheduleCursorRedraw();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleCursorRedraw is synced through scheduleCursorRedrawRef
    [getCursorRect],
  );

  const clearCursor = useCallback(() => {
    cursorPosRef.current = null;
    forceSrcRedrawRef.current = true;
    scheduleCursorRedraw();
    const el = statusRef.current;
    if (el) {
      el.textContent = "\u2014";
      el.title = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleCursorRedraw is synced through scheduleCursorRedrawRef
  }, [statusRef]);

  const trackPreviewCursor = useCallback(
    (e: React.PointerEvent) => {
      const c = previewCursorRef.current;
      if (!c) return;
      const r = getPreviewCursorRect();
      previewCursorPosRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      scheduleCursorRedraw();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleCursorRedraw is synced through scheduleCursorRedrawRef
    [getPreviewCursorRect],
  );

  const clearPreviewCursor = useCallback(() => {
    previewCursorPosRef.current = null;
    forcePrvRedrawRef.current = true;
    scheduleCursorRedraw();
    const el = statusRef.current;
    if (el) {
      el.textContent = "\u2014";
      el.title = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleCursorRedraw is synced through scheduleCursorRedrawRef
  }, [statusRef]);

  return {
    cursorCanvasRef,
    previewCursorRef,
    cursorRafRef,
    scheduleCursorRedrawRef,
    cursorPosRef,
    previewCursorPosRef,
    trackCursor,
    clearCursor,
    trackPreviewCursor,
    clearPreviewCursor,
    scheduleCursorRedraw,
  };
}
