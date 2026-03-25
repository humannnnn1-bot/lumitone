import { useRef, useCallback } from "react";
import { LEVEL_MASK, isShapeTool } from "../constants";
import type { ToolId } from "../constants";
import { LEVEL_INFO, LEVEL_CANDIDATES } from "../color-engine";
import { paintCircle, paintLine, SHAPE_PAINTERS } from "../paint";
import { shapeBBox, unionBBox, brushBBox, restoreRect } from "../dirty-rect";
import { computeDiff, buildDiffFromFill } from "../undo-diff";
import { useFloodFillWorker } from "./useFloodFillWorker";
import { renderBuf } from "../render-buf";
import { hexStr } from "../utils";
import { useSyncRef, useSyncRefs } from "./useSyncRef";
import { useCursorOverlay } from "./useCursorOverlay";
import { trySetPointerCapture, cPosFromRefs, updateStatusBase } from "./useDrawingBase";
import type { DrawingRefs } from "./useDrawingBase";
import type { CanvasData, StrokeState, ImgCache, CanvasAction } from "../types";
import { useDrawingContext } from "../contexts/DrawingContext";

export interface CanvasDrawingResult {
  srcRef: React.MutableRefObject<HTMLCanvasElement | null>;
  curRef: React.MutableRefObject<HTMLCanvasElement | null>;
  prvCurRef: React.MutableRefObject<HTMLCanvasElement | null>;
  statusRef: React.MutableRefObject<HTMLDivElement | null>;
  imgCacheRef: React.MutableRefObject<ImgCache>;
  strokeRef: React.MutableRefObject<StrokeState | null>;
  drawingRef: React.MutableRefObject<boolean>;
  lastRef: React.MutableRefObject<{ x: number; y: number } | null>;
  cursorRafRef: React.MutableRefObject<number | null>;
  schedCursorRef: React.MutableRefObject<(() => void) | null>;
  cursorPosRef: React.MutableRefObject<{ dx: number; dy: number } | null>;
  onDown: (e: React.PointerEvent) => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: () => void;
  trackCursor: (e: React.PointerEvent) => void;
  clearCursor: () => void;
  onDownPrv: (e: React.PointerEvent) => void;
  onMovePrv: (e: React.PointerEvent) => void;
  trackCursorPrv: (e: React.PointerEvent) => void;
  clearCursorPrv: () => void;
}

export interface CanvasDrawingOptions {
  cvs: CanvasData;
  dispatch: React.Dispatch<CanvasAction>;
  colorLUT: [number, number, number][];
  cc: number[];
  brushLevel: number;
  brushSize: number;
  tool: ToolId;
  prvRef: React.MutableRefObject<HTMLCanvasElement | null>;
  setBrushLevel: (lv: number) => void;
}

export function useCanvasDrawing(opts: CanvasDrawingOptions): CanvasDrawingResult {
  const {
    cvs, dispatch, colorLUT, cc,
    brushLevel, brushSize, tool,
    prvRef,
    setBrushLevel,
  } = opts;
  const ctx = useDrawingContext();
  const { displayW, displayH, panningRef, spaceRef, zoomRef, panRef, startPan, movePan, endPan, announce, t } = ctx;
  const srcRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const imgCacheRef = useRef<ImgCache>({ src: null, prv: null, s32: null, p32: null });
  const strokeRef = useRef<StrokeState | null>(null);
  const drawingRef = useRef(false);
  // Buffer pool: reuse pre/buf allocations across strokes
  const bufPoolRef = useRef<{ pre: Uint8Array | null; buf: Uint8Array | null; size: number }>({ pre: null, buf: null, size: 0 });
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintRafRef = useRef<number | null>(null);
  const fillPendingRef = useRef(false);
  const pendingUpRef = useRef(false);
  const floodFillWorker = useFloodFillWorker();

  // Refs needed by useCursorOverlay (individual for interface compatibility)
  const brushSizeRef = useSyncRef(brushSize);
  const toolRef = useSyncRef(tool);
  const cvsRef = useSyncRef(cvs);
  const displayWRef = useSyncRef(displayW);
  const displayHRef = useSyncRef(displayH);

  // Batch-sync remaining values used in imperative callbacks
  const s = useSyncRefs({ cc, brushLevel, colorLUT, startPan, movePan, endPan, setBrushLevel, announce, t });

  // Cursor overlay sub-hook
  const cursor = useCursorOverlay(
    { zoomRef, panRef, cvsRef, displayWRef, displayHRef, panningRef, brushSizeRef, toolRef },
    statusRef,
  );

  const drawRefs: DrawingRefs = { zoomRef, panRef, cvsRef };

  function cPos(e: React.PointerEvent, refEl?: HTMLCanvasElement | null) {
    const c = refEl ?? activeCanvasRef.current ?? cursor.curRef.current;
    return cPosFromRefs(e, c, drawRefs);
  }

  function updateStatus(e: React.PointerEvent) {
    const d = drawingRef.current && strokeRef.current?.buf ? strokeRef.current.buf : cvsRef.current.data;
    updateStatusBase(
      e, statusRef.current, activeCanvasRef.current ?? cursor.curRef.current, drawRefs, d,
      (pos, lv, info, _idx) => {
        const a = LEVEL_CANDIDATES[lv], ci = s.current.cc[lv] % a.length, cur = a[ci];
        return `(${pos.x}, ${pos.y})  L${lv} ${info.name}  ${hexStr(cur.rgb)}`;
      },
    );
  }

  function drawShapeAt(buf: Uint8Array, toolId: string, x0: number, y0: number, x1: number, y1: number, r: number, lv: number, w: number, h: number) {
    SHAPE_PAINTERS[toolId]?.(buf, x0, y0, x1, y1, r, lv, w, h);
  }

  function doDown(e: React.PointerEvent, refEl: HTMLCanvasElement | null) {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    e.preventDefault();
    if (drawingRef.current || fillPendingRef.current) return;
    activeCanvasRef.current = refEl;
    if (e.button === 2 || (e.button === 0 && e.altKey)) {
      const pos = cPos(e, refEl);
      const cv = cvsRef.current;
      if (pos.x >= 0 && pos.x < cv.w && pos.y >= 0 && pos.y < cv.h) {
        const lv = cv.data[pos.y * cv.w + pos.x] & LEVEL_MASK;
        s.current.setBrushLevel(lv);
        const info = LEVEL_INFO[lv];
        s.current.announce(s.current.t("announce_level", lv, info.name));
      }
      return;
    }
    if (e.button === 1 || spaceRef.current) { s.current.startPan(e); return; }
    trySetPointerCapture(e);
    drawingRef.current = true;
    const curTool = toolRef.current, curBL = s.current.brushLevel, curBS = brushSizeRef.current;
    const pos = cPos(e, refEl);
    lastRef.current = pos;
    const cv = cvsRef.current;
    const n = cv.data.length;
    const pool = bufPoolRef.current;
    if (!pool.pre || !pool.buf || pool.size !== n) {
      pool.pre = new Uint8Array(n);
      pool.buf = new Uint8Array(n);
      pool.size = n;
    }
    pool.pre.set(cv.data);
    pool.buf.set(cv.data);
    const pre: Uint8Array = pool.pre;
    const buf: Uint8Array = pool.buf;
    strokeRef.current = {
      buf, pre,
      params: { tool: curTool, brushLevel: curBL, brushSize: curBS },
      shapeStart: pos,
      prevShapeBBox: null,
      fillChanged: null,
    };
    const lv = curTool === "eraser" ? 0 : curBL;
    const r = Math.floor(curBS / 2);
    const W = cv.w, H = cv.h;

    if (curTool === "fill") {
      fillPendingRef.current = true;
      floodFillWorker.requestCanvasFill(buf, pos.x, pos.y, lv, W, H).then((res) => {
        const st = strokeRef.current;
        if (!st) { fillPendingRef.current = false; return; }
        st.buf.set(res.data);
        if (res.changed.length > 0) {
          st.fillChanged = res.changed;
          if (res.truncated) s.current.announce(s.current.t("toast_fill_truncated"));
        }
        renderBuf(st.buf, W, H, s.current.colorLUT, srcRef.current, prvRef.current, imgCacheRef.current);
        fillPendingRef.current = false;
        if (pendingUpRef.current) {
          pendingUpRef.current = false;
          finishStroke();
        }
      }).catch((err) => {
        fillPendingRef.current = false;
        pendingUpRef.current = false;
        strokeRef.current = null;
        drawingRef.current = false;
        s.current.announce(s.current.t("toast_fill_error"));
        console.error("CHROMALUM: canvas flood fill failed:", err);
      });
      return;
    } else if (isShapeTool(curTool)) {
      drawShapeAt(buf, curTool, pos.x, pos.y, pos.x, pos.y, r, lv, W, H);
      strokeRef.current.prevShapeBBox = shapeBBox(pos.x, pos.y, pos.x, pos.y, r, W, H);
    } else {
      paintCircle(buf, pos.x, pos.y, r, lv, W, H);
      const dirtyBB = brushBBox([[pos.x, pos.y]], r, W, H);
      renderBuf(buf, W, H, s.current.colorLUT, srcRef.current, prvRef.current, imgCacheRef.current, dirtyBB);
      return;
    }
    renderBuf(buf, W, H, s.current.colorLUT, srcRef.current, prvRef.current, imgCacheRef.current);
  }

  function doMove(e: React.PointerEvent, refEl: HTMLCanvasElement | null, cursorTrack: (e: React.PointerEvent) => void) {
    cursorTrack(e); updateStatus(e);
    if (panningRef.current) { s.current.movePan(e); return; }
    if (!drawingRef.current) return;
    const st = strokeRef.current;
    if (!st || st.params.tool === "fill") return;
    e.preventDefault();
    const sp = st.params;
    const pos = cPos(e, refEl), last = lastRef.current || pos;
    const buf = st.buf;
    const lv = sp.tool === "eraser" ? 0 : sp.brushLevel;
    const r = Math.floor(sp.brushSize / 2);
    const cv = cvsRef.current;
    const W = cv.w, H = cv.h;

    if (isShapeTool(sp.tool)) {
      const origin = st.shapeStart || pos;
      const newBB = shapeBBox(origin.x, origin.y, pos.x, pos.y, r, W, H);
      const prevBB = st.prevShapeBBox;
      const dirtyBB = unionBBox(prevBB, newBB);
      if (st.pre && dirtyBB) restoreRect(buf, st.pre, W, dirtyBB);
      drawShapeAt(buf, sp.tool, origin.x, origin.y, pos.x, pos.y, r, lv, W, H);
      st.prevShapeBBox = newBB;
      lastRef.current = pos;
      renderBuf(buf, W, H, s.current.colorLUT, srcRef.current, prvRef.current, imgCacheRef.current, dirtyBB);
      return;
    } else {
      paintLine(buf, last.x, last.y, pos.x, pos.y, r, lv, W, H);
      const allPts: [number, number][] = [[last.x, last.y], [pos.x, pos.y]];
      const dirtyBB = brushBBox(allPts, r, W, H);
      lastRef.current = pos;
      // Throttle rendering to animation frame rate
      if (paintRafRef.current !== null) cancelAnimationFrame(paintRafRef.current);
      const lutSnap = s.current.colorLUT, srcSnap = srcRef.current, prvSnap = prvRef.current, cacheSnap = imgCacheRef.current;
      paintRafRef.current = requestAnimationFrame(() => {
        paintRafRef.current = null;
        renderBuf(buf, W, H, lutSnap, srcSnap, prvSnap, cacheSnap, dirtyBB);
      });
      return;
    }
  }

  const onDown = useCallback((e: React.PointerEvent) => {
    doDown(e, cursor.curRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doDown reads from sync refs, cursor.curRef is stable
  }, []);

  const onMove = useCallback((e: React.PointerEvent) => {
    doMove(e, cursor.curRef.current, cursor.trackCursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doMove reads from sync refs, cursor.curRef is stable
  }, [cursor.trackCursor]);

  const onDownPrv = useCallback((e: React.PointerEvent) => {
    doDown(e, cursor.prvCurRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doDown reads from sync refs, cursor.prvCurRef is stable
  }, []);

  const onMovePrv = useCallback((e: React.PointerEvent) => {
    doMove(e, cursor.prvCurRef.current, cursor.trackCursorPrv);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doMove reads from sync refs, cursor.prvCurRef is stable
  }, [cursor.trackCursorPrv]);

  function finishStroke() {
    // Flush pending brush render
    if (paintRafRef.current !== null) {
      cancelAnimationFrame(paintRafRef.current);
      paintRafRef.current = null;
      const st2 = strokeRef.current;
      if (st2) renderBuf(st2.buf, cvsRef.current.w, cvsRef.current.h, s.current.colorLUT, srcRef.current, prvRef.current, imgCacheRef.current);
    }
    const st = strokeRef.current;
    if (drawingRef.current && st) {
      const finalData = new Uint8Array(st.buf);
      const diff = st.fillChanged && st.pre
        ? buildDiffFromFill(st.pre, finalData, st.fillChanged)
        : st.pre ? computeDiff(st.pre, finalData) : null;
      dispatch({ type: "stroke_end", finalData, diff });
    }
    drawingRef.current = false; lastRef.current = null;
    strokeRef.current = null;
    activeCanvasRef.current = null;
  }

  const onUp = useCallback(() => {
    if (panningRef.current) { s.current.endPan(); return; }
    if (fillPendingRef.current) { pendingUpRef.current = true; return; }
    finishStroke();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable, read via .current
  }, [dispatch]);

  return {
    srcRef, curRef: cursor.curRef, prvCurRef: cursor.prvCurRef, statusRef, imgCacheRef,
    strokeRef, drawingRef, lastRef,
    cursorRafRef: cursor.cursorRafRef, schedCursorRef: cursor.schedCursorRef, cursorPosRef: cursor.cursorPosRef,
    onDown, onMove, onUp,
    trackCursor: cursor.trackCursor, clearCursor: cursor.clearCursor,
    onDownPrv, onMovePrv,
    trackCursorPrv: cursor.trackCursorPrv, clearCursorPrv: cursor.clearCursorPrv,
  };
}
