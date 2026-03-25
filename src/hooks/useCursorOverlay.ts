import { useRef, useLayoutEffect, useCallback } from "react";
import { GRID_ZOOM_THRESHOLD, isShapeTool } from "../constants";
import type { ToolId } from "../constants";
import { useRectCache } from "./useRectCache";

export interface CursorOverlayRefs {
  zoomRef: React.MutableRefObject<number>;
  panRef: React.MutableRefObject<{ x: number; y: number }>;
  cvsRef: React.MutableRefObject<{ w: number; h: number }>;
  displayWRef: React.MutableRefObject<number>;
  displayHRef: React.MutableRefObject<number>;
  panningRef: React.MutableRefObject<boolean>;
  brushSizeRef: React.MutableRefObject<number>;
  toolRef: React.MutableRefObject<ToolId>;
}

export interface CursorOverlayResult {
  curRef: React.MutableRefObject<HTMLCanvasElement | null>;
  prvCurRef: React.MutableRefObject<HTMLCanvasElement | null>;
  cursorRafRef: React.MutableRefObject<number | null>;
  schedCursorRef: React.MutableRefObject<(() => void) | null>;
  cursorPosRef: React.MutableRefObject<{ dx: number; dy: number } | null>;
  prvCursorPosRef: React.MutableRefObject<{ dx: number; dy: number } | null>;
  trackCursor: (e: React.PointerEvent) => void;
  clearCursor: () => void;
  trackCursorPrv: (e: React.PointerEvent) => void;
  clearCursorPrv: () => void;
  schedCursor: () => void;
}

export function useCursorOverlay(refs: CursorOverlayRefs, statusRef: React.MutableRefObject<HTMLDivElement | null>): CursorOverlayResult {
  const curRef = useRef<HTMLCanvasElement | null>(null);
  const prvCurRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRafRef = useRef<number | null>(null);
  const schedCursorRef = useRef<(() => void) | null>(null);
  const cursorPosRef = useRef<{ dx: number; dy: number } | null>(null);
  const prvCursorPosRef = useRef<{ dx: number; dy: number } | null>(null);
  const prevGridStateRef = useRef<string>("");
  const getCurRect = useRectCache(curRef);
  const getPrvRect = useRectCache(prvCurRef);

  const { zoomRef, panRef, cvsRef, displayWRef, displayHRef, panningRef, brushSizeRef, toolRef } = refs;

  function drawCursorAndGridOn(c: HTMLCanvasElement | null, posRef: React.MutableRefObject<{ dx: number; dy: number } | null>) {
    if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const z = zoomRef.current, cv = cvsRef.current, p = panRef.current;
    const dW = displayWRef.current, dH = displayHRef.current;
    const pxPerCell = (dW / cv.w) * z;

    if (z >= GRID_ZOOM_THRESHOLD && pxPerCell >= 4) {
      const offsetX = dW * (0.5 - z / 2 + z * p.x / cv.w);
      const offsetY = dH * (0.5 - z / 2 + z * p.y / cv.h);
      const endY = Math.min(dH, offsetY + cv.h * pxPerCell);
      const endX = Math.min(dW, offsetX + cv.w * pxPerCell);
      const xStart = Math.max(0, Math.ceil(-offsetX / pxPerCell));
      const xEnd   = Math.min(cv.w, Math.floor((dW - offsetX) / pxPerCell));
      const yStart = Math.max(0, Math.ceil(-offsetY / pxPerCell));
      const yEnd   = Math.min(cv.h, Math.floor((dH - offsetY) / pxPerCell));
      ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = xStart; x <= xEnd; x++) {
        const px = offsetX + x * pxPerCell;
        ctx.moveTo(px, Math.max(0, offsetY)); ctx.lineTo(px, endY);
      }
      for (let y = yStart; y <= yEnd; y++) {
        const py = offsetY + y * pxPerCell;
        ctx.moveTo(Math.max(0, offsetX), py); ctx.lineTo(endX, py);
      }
      ctx.stroke();
    }
    const pos = posRef.current;
    if (!pos || panningRef.current) return;
    const curBS = brushSizeRef.current;
    const rPx = Math.floor(curBS / 2);
    const curTool = toolRef.current;
    // snap cursor to canvas pixel center
    const rx = pos.dx / dW, ry = pos.dy / dH;
    const vx = (rx - 0.5) / z + 0.5 - p.x / cv.w;
    const vy = (ry - 0.5) / z + 0.5 - p.y / cv.h;
    const cx = Math.floor(vx * cv.w), cy = Math.floor(vy * cv.h);
    const sdx = dW * (((cx + 0.5) / cv.w - 0.5 + p.x / cv.w) * z + 0.5);
    const sdy = dH * (((cy + 0.5) / cv.h - 0.5 + p.y / cv.h) * z + 0.5);
    const brushColor = curTool === "eraser" ? "rgba(255,100,100,.8)" : "rgba(255,255,255,.8)";
    const brushR = rPx;
    if (curTool !== "fill") {
      ctx.beginPath();
      if (brushR <= 0) {
        ctx.rect(sdx - pxPerCell / 2, sdy - pxPerCell / 2, pxPerCell, pxPerCell);
      } else {
        for (let dy = -brushR; dy <= brushR; dy++) {
          for (let dx = -brushR; dx <= brushR; dx++) {
            if (dx * dx + dy * dy > brushR * brushR) continue;
            const px = sdx + (dx - 0.5) * pxPerCell;
            const py = sdy + (dy - 0.5) * pxPerCell;
            if (dy === -brushR || dx * dx + (dy - 1) * (dy - 1) > brushR * brushR)
              { ctx.moveTo(px, py); ctx.lineTo(px + pxPerCell, py); }
            if (dy === brushR || dx * dx + (dy + 1) * (dy + 1) > brushR * brushR)
              { ctx.moveTo(px, py + pxPerCell); ctx.lineTo(px + pxPerCell, py + pxPerCell); }
            if (dx === -brushR || (dx - 1) * (dx - 1) + dy * dy > brushR * brushR)
              { ctx.moveTo(px, py); ctx.lineTo(px, py + pxPerCell); }
            if (dx === brushR || (dx + 1) * (dx + 1) + dy * dy > brushR * brushR)
              { ctx.moveTo(px + pxPerCell, py); ctx.lineTo(px + pxPerCell, py + pxPerCell); }
          }
        }
      }
      ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = brushColor; ctx.lineWidth = 1; ctx.stroke();
    }
    if (curTool === "fill" || isShapeTool(curTool)) {
      const cs = 8;
      ctx.beginPath();
      ctx.moveTo(sdx - cs, sdy); ctx.lineTo(sdx + cs, sdy);
      ctx.moveTo(sdx, sdy - cs); ctx.lineTo(sdx, sdy + cs);
      ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = "rgba(200,220,255,.7)"; ctx.lineWidth = 1; ctx.stroke();
    }
  }

  function drawCursorAndGrid() {
    // Only redraw canvases that have a cursor or need grid update
    const hasSrc = cursorPosRef.current !== null;
    const hasPrv = prvCursorPosRef.current !== null;
    const z = zoomRef.current, p = panRef.current, cv = cvsRef.current;
    const gridKey = `${z}_${p.x}_${p.y}_${cv.w}_${cv.h}_${brushSizeRef.current}_${toolRef.current}_${panningRef.current}`;
    const gridChanged = gridKey !== prevGridStateRef.current;
    if (gridChanged) prevGridStateRef.current = gridKey;
    // Always redraw if grid changed (zoom/pan), otherwise only the canvas with active cursor
    if (hasSrc || gridChanged) drawCursorAndGridOn(curRef.current, cursorPosRef);
    if (hasPrv || gridChanged) drawCursorAndGridOn(prvCurRef.current, prvCursorPosRef);
  }

  function schedCursor() {
    if (cursorRafRef.current) return;
    cursorRafRef.current = requestAnimationFrame(() => { cursorRafRef.current = null; drawCursorAndGrid(); });
  }

  // Intentionally runs every render (no deps) to keep ref in sync with latest closure
  useLayoutEffect(() => { schedCursorRef.current = schedCursor; });

  const trackCursor = useCallback((e: React.PointerEvent) => {
    const c = curRef.current; if (!c) return;
    const r = getCurRect();
    cursorPosRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    schedCursor();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- schedCursor is stable (synced via ref)
  }, [getCurRect]);

  const clearCursor = useCallback(() => {
    cursorPosRef.current = null; schedCursor();
    const el = statusRef.current; if (el) el.textContent = "\u2014";
    // eslint-disable-next-line react-hooks/exhaustive-deps -- schedCursor is stable
  }, [statusRef]);

  const trackCursorPrv = useCallback((e: React.PointerEvent) => {
    const c = prvCurRef.current; if (!c) return;
    const r = getPrvRect();
    prvCursorPosRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    schedCursor();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- schedCursor is stable
  }, [getPrvRect]);

  const clearCursorPrv = useCallback(() => {
    prvCursorPosRef.current = null; schedCursor();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- schedCursor is stable
  }, []);

  return {
    curRef, prvCurRef, cursorRafRef, schedCursorRef,
    cursorPosRef, prvCursorPosRef,
    trackCursor, clearCursor, trackCursorPrv, clearCursorPrv,
    schedCursor,
  };
}
