import { useRef, useCallback } from "react";
import { LEVEL_MASK } from "../constants";
import type { ToolId } from "../constants";
import { LEVEL_INFO } from "../color-engine";
import {
  allocateStrokeBuffers,
  createStrokeState,
  applyBrushStroke,
  applyBrushDot,
  applyShapeStroke,
  applyShapeDot,
  computeStrokeResult,
  resolveLevel,
  isShapeTool,
} from "./useStrokeManager";
import { useFloodFillWorker } from "./useFloodFillWorker";
import { renderCanvasBuffers } from "../drawing/render-buf";
import { formatColorPixelStatus, formatSourcePixelStatus } from "../utils/pixel-status";
import type { BufferPool } from "./useStrokeManager";
import { useSyncRef, useSyncRefs } from "./useSyncRef";
import { useCursorOverlay } from "./useCursorOverlay";
import { trySetPointerCapture, canvasPosFromRefs, canvasPosUnclamped, isCanvasPointInBounds, updateStatusBase } from "./useDrawingBase";
import type { DrawingRefs } from "./useDrawingBase";
import { unionBBox } from "../drawing/dirty-rect";
import { createStrokeSmoother, smoothStrokePoint } from "../drawing/stroke-smoothing";
import type { StrokeSmoother } from "../drawing/stroke-smoothing";
import { pressureAdjustedBrushSize } from "../drawing/stroke-pressure";
import type { PointerPressureSample } from "../drawing/stroke-pressure";
import type { CanvasData, StrokeState, ImageRenderCache, CanvasAction, DirtyRect, Point } from "../types";
import { useDrawingContext } from "../state/DrawingContext";

export interface CanvasDrawingResult {
  sourceCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  cursorCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  previewCursorRef: React.MutableRefObject<HTMLCanvasElement | null>;
  statusRef: React.MutableRefObject<HTMLDivElement | null>;
  imgCacheRef: React.MutableRefObject<ImageRenderCache>;
  strokeRef: React.MutableRefObject<StrokeState | null>;
  drawingRef: React.MutableRefObject<boolean>;
  lastRef: React.MutableRefObject<{ x: number; y: number } | null>;
  cursorRafRef: React.MutableRefObject<number | null>;
  scheduleCursorRedrawRef: React.MutableRefObject<(() => void) | null>;
  cursorPosRef: React.MutableRefObject<{ dx: number; dy: number } | null>;
  onDown: (e: React.PointerEvent) => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: () => void;
  onWorkspaceDown: (e: React.PointerEvent) => void;
  onWorkspaceMove: (e: React.PointerEvent) => void;
  onWorkspaceLeave: (e: React.PointerEvent) => void;
  trackCursor: (e: React.PointerEvent) => void;
  clearCursor: () => void;
  onPreviewPointerDown: (e: React.PointerEvent) => void;
  onPreviewPointerMove: (e: React.PointerEvent) => void;
  onPreviewWorkspacePointerDown: (e: React.PointerEvent) => void;
  onPreviewWorkspacePointerMove: (e: React.PointerEvent) => void;
  onWorkspaceLeavePrv: (e: React.PointerEvent) => void;
  trackPreviewCursor: (e: React.PointerEvent) => void;
  clearPreviewCursor: () => void;
}

interface CanvasDrawingOptions {
  canvasData: CanvasData;
  dispatch: React.Dispatch<CanvasAction>;
  colorLUT: [number, number, number][];
  candidateIndexByLevel: readonly number[];
  brushLevel: number;
  brushSize: number;
  tool: ToolId;
  previewCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  setBrushLevel: (lv: number) => void;
}

type CanvasStatusMode = "source" | "color";

export function useCanvasDrawing(opts: CanvasDrawingOptions): CanvasDrawingResult {
  const { canvasData, dispatch, colorLUT, candidateIndexByLevel, brushLevel, brushSize, tool, previewCanvasRef, setBrushLevel } = opts;
  const ctx = useDrawingContext();
  const { displayWidth, displayHeight, panningRef, spaceRef, zoomRef, panRef, startPan, movePan, endPan, announce, t } = ctx;
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const imgCacheRef = useRef<ImageRenderCache>({
    sourceImageData: null,
    previewImageData: null,
    sourcePixels32: null,
    previewPixels32: null,
  });
  const strokeRef = useRef<StrokeState | null>(null);
  const drawingRef = useRef(false);
  // Buffer pool: reuse before/working allocations across strokes
  const strokeBufferPoolRef = useRef<BufferPool>({ beforeData: null, workingData: null, size: 0 });
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const strokeSmootherRef = useRef<StrokeSmoother | null>(null);
  const forceRawNextMoveRef = useRef(false);
  const activeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintRafRef = useRef<number | null>(null);
  const pendingPaintDirtyRef = useRef<DirtyRect | null>(null);
  const paintFrameRef = useRef<{
    levelData: Uint8Array;
    w: number;
    h: number;
    lut: [number, number, number][];
    sourceCanvas: HTMLCanvasElement | null;
    previewCanvas: HTMLCanvasElement | null;
    imgCache: ImageRenderCache;
  } | null>(null);
  const fillPendingRef = useRef(false);
  const pendingUpRef = useRef(false);
  const pendingWorkspaceStartRef = useRef<{
    refEl: HTMLCanvasElement | null;
    cursorTrack: (e: React.PointerEvent) => void;
    clearCursor: () => void;
    startPos: Point;
  } | null>(null);
  const floodFillWorker = useFloodFillWorker();

  // Refs needed by useCursorOverlay (individual for interface compatibility)
  const brushSizeRef = useSyncRef(brushSize);
  const toolRef = useSyncRef(tool);
  const canvasDataRef = useSyncRef(canvasData);
  const displayWidthRef = useSyncRef(displayWidth);
  const displayHeightRef = useSyncRef(displayHeight);

  // Batch-sync remaining values used in imperative callbacks
  const s = useSyncRefs({ candidateIndexByLevel, brushLevel, colorLUT, startPan, movePan, endPan, setBrushLevel, announce, t });

  // Cursor overlay sub-hook
  const cursor = useCursorOverlay(
    { zoomRef, panRef, canvasDataRef, displayWidthRef, displayHeightRef, panningRef, brushSizeRef, toolRef },
    statusRef,
  );

  const drawRefs: DrawingRefs = { zoomRef, panRef, canvasDataRef };

  function cPos(e: React.PointerEvent, refEl?: HTMLCanvasElement | null) {
    const c = refEl ?? activeCanvasRef.current ?? cursor.cursorCanvasRef.current;
    return canvasPosFromRefs(e, c, drawRefs);
  }

  function isInCanvasBounds(e: React.PointerEvent, refEl: HTMLCanvasElement | null) {
    const pos = canvasPosUnclamped(e, refEl, zoomRef.current, panRef.current, canvasDataRef.current);
    return isCanvasPointInBounds(pos, canvasDataRef.current);
  }

  function isInWorkspaceBounds(e: React.PointerEvent, refEl: HTMLCanvasElement | null) {
    if (!refEl) return false;
    const r = refEl.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    return e.clientX >= r.left && e.clientX < r.left + r.width && e.clientY >= r.top && e.clientY < r.top + r.height;
  }

  function updateStatus(e: React.PointerEvent, refEl: HTMLCanvasElement | null, mode: CanvasStatusMode) {
    const d = drawingRef.current && strokeRef.current?.workingData ? strokeRef.current.workingData : canvasDataRef.current.levelData;
    const statusCanvas =
      refEl ?? activeCanvasRef.current ?? (mode === "color" ? cursor.previewCursorRef.current : cursor.cursorCanvasRef.current);
    updateStatusBase(e, statusRef.current, statusCanvas, drawRefs, d, (pos, lv) =>
      mode === "source"
        ? formatSourcePixelStatus({ x: pos.x, y: pos.y, lv })
        : formatColorPixelStatus({ x: pos.x, y: pos.y, lv, candidateIndexByLevel: s.current.candidateIndexByLevel }),
    );
  }

  function queueBrushRender(levelData: Uint8Array, W: number, H: number, dirtyBB: DirtyRect) {
    pendingPaintDirtyRef.current = unionBBox(pendingPaintDirtyRef.current, dirtyBB);
    paintFrameRef.current = {
      levelData,
      w: W,
      h: H,
      lut: s.current.colorLUT,
      sourceCanvas: sourceCanvasRef.current,
      previewCanvas: previewCanvasRef.current,
      imgCache: imgCacheRef.current,
    };

    if (paintRafRef.current !== null) return;

    paintRafRef.current = requestAnimationFrame(() => {
      paintRafRef.current = null;
      const dirtySnap = pendingPaintDirtyRef.current;
      const frame = paintFrameRef.current;
      pendingPaintDirtyRef.current = null;
      paintFrameRef.current = null;
      if (dirtySnap && frame) {
        renderCanvasBuffers(
          frame.levelData,
          frame.w,
          frame.h,
          frame.lut,
          frame.sourceCanvas,
          frame.previewCanvas,
          frame.imgCache,
          dirtySnap,
        );
      }
    });
  }

  function doDown(e: React.PointerEvent, refEl: HTMLCanvasElement | null, buttonOverride?: 0 | 1 | 2, startPos?: Point) {
    const button = buttonOverride ?? e.button;
    if (button !== 0 && button !== 1 && button !== 2) return;
    e.preventDefault();
    if (drawingRef.current || fillPendingRef.current) return;
    activeCanvasRef.current = refEl;
    if (buttonOverride === undefined && (button === 2 || (button === 0 && e.altKey))) {
      const pos = cPos(e, refEl);
      const cv = canvasDataRef.current;
      if (pos.x >= 0 && pos.x < cv.width && pos.y >= 0 && pos.y < cv.height) {
        const lv = cv.levelData[pos.y * cv.width + pos.x] & LEVEL_MASK;
        s.current.setBrushLevel(lv);
        const info = LEVEL_INFO[lv];
        s.current.announce(s.current.t("announce_level", lv, info.name));
      }
      return;
    }
    if (button === 1 || spaceRef.current) {
      s.current.startPan(e);
      return;
    }
    trySetPointerCapture(e);
    drawingRef.current = true;
    const curTool = toolRef.current,
      curBL = s.current.brushLevel,
      curBS = brushSizeRef.current;
    const pos = startPos ?? cPos(e, refEl);
    lastRef.current = pos;
    strokeSmootherRef.current = curTool === "fill" || isShapeTool(curTool) ? null : createStrokeSmoother(pos);
    forceRawNextMoveRef.current = startPos !== undefined && !isCanvasPointInBounds(startPos, canvasDataRef.current);
    const cv = canvasDataRef.current;
    const { beforeData, workingData } = allocateStrokeBuffers(strokeBufferPoolRef.current, cv.levelData);
    strokeRef.current = createStrokeState(workingData, beforeData, curTool, curBL, curBS, pos);
    const lv = resolveLevel(curTool, curBL);
    const W = cv.width,
      H = cv.height;

    if (curTool === "fill") {
      fillPendingRef.current = true;
      floodFillWorker
        .requestCanvasFill(workingData, pos.x, pos.y, lv, W, H)
        .then((res) => {
          const st = strokeRef.current;
          if (!st) {
            fillPendingRef.current = false;
            return;
          }
          st.workingData.set(res.levelData);
          if (res.changedIndices.length > 0) {
            st.fillChangedIndices = res.changedIndices;
            if (res.truncated) s.current.announce(s.current.t("toast_fill_truncated"));
          }
          renderCanvasBuffers(
            st.workingData,
            W,
            H,
            s.current.colorLUT,
            sourceCanvasRef.current,
            previewCanvasRef.current,
            imgCacheRef.current,
          );
          fillPendingRef.current = false;
          if (pendingUpRef.current) {
            pendingUpRef.current = false;
            finishStroke();
          }
        })
        .catch((err) => {
          fillPendingRef.current = false;
          pendingUpRef.current = false;
          strokeRef.current = null;
          drawingRef.current = false;
          s.current.announce(s.current.t("toast_fill_error"));
          console.error("CHROMALUM: canvas flood fill failed:", err);
        });
      return;
    } else if (isShapeTool(curTool)) {
      const bb = applyShapeDot(workingData, curTool, pos, curBS, lv, W, H);
      strokeRef.current.prevShapeBBox = bb;
      if (bb)
        renderCanvasBuffers(
          workingData,
          W,
          H,
          s.current.colorLUT,
          sourceCanvasRef.current,
          previewCanvasRef.current,
          imgCacheRef.current,
          bb,
        );
    } else {
      const effectiveBrushSize = pressureAdjustedBrushSize(curBS, e.nativeEvent);
      const dirtyBB = applyBrushDot(workingData, pos, effectiveBrushSize, lv, W, H);
      if (dirtyBB)
        renderCanvasBuffers(
          workingData,
          W,
          H,
          s.current.colorLUT,
          sourceCanvasRef.current,
          previewCanvasRef.current,
          imgCacheRef.current,
          dirtyBB,
        );
    }
  }

  function canArmWorkspaceStart(e: React.PointerEvent) {
    return e.button === 0 && !e.altKey && toolRef.current !== "fill";
  }

  function doWorkspaceDown(
    e: React.PointerEvent,
    refEl: HTMLCanvasElement | null,
    cursorTrack: (e: React.PointerEvent) => void,
    clearCursor: () => void,
    statusMode: CanvasStatusMode,
  ) {
    pendingWorkspaceStartRef.current = null;
    if (e.button === 1 || spaceRef.current || isInCanvasBounds(e, refEl)) {
      doDown(e, refEl);
      return;
    }
    e.preventDefault();
    if (!isInWorkspaceBounds(e, refEl)) {
      clearCursor();
      return;
    }
    cursorTrack(e);
    updateStatus(e, refEl, statusMode);
    if (!canArmWorkspaceStart(e)) return;
    trySetPointerCapture(e);
    pendingWorkspaceStartRef.current = {
      refEl,
      cursorTrack,
      clearCursor,
      startPos: canvasPosUnclamped(e, refEl, zoomRef.current, panRef.current, canvasDataRef.current),
    };
  }

  function doWorkspaceMove(
    e: React.PointerEvent,
    refEl: HTMLCanvasElement | null,
    cursorTrack: (e: React.PointerEvent) => void,
    clearCursor: () => void,
    statusMode: CanvasStatusMode,
  ) {
    const pending = pendingWorkspaceStartRef.current;
    if (pending) {
      e.preventDefault();
      const pendingRefEl = pending.refEl ?? refEl;
      if (isInWorkspaceBounds(e, pendingRefEl)) {
        pending.cursorTrack(e);
        updateStatus(e, pendingRefEl, statusMode);
      } else {
        pending.clearCursor();
      }
      if ((e.buttons & 1) !== 1) {
        pendingWorkspaceStartRef.current = null;
        clearCursor();
        return;
      }
      if (!isInCanvasBounds(e, pendingRefEl)) return;
      pendingWorkspaceStartRef.current = null;
      doDown(e, pendingRefEl, 0, pending.startPos);
      doMove(e, pendingRefEl, pending.cursorTrack, pending.clearCursor, statusMode);
      return;
    }
    if (!drawingRef.current && !panningRef.current && !isInCanvasBounds(e, refEl)) {
      if (isInWorkspaceBounds(e, refEl)) {
        cursorTrack(e);
        updateStatus(e, refEl, statusMode);
      } else {
        clearCursor();
      }
      return;
    }
    doMove(e, refEl, cursorTrack, clearCursor, statusMode);
  }

  function doMove(
    e: React.PointerEvent,
    refEl: HTMLCanvasElement | null,
    cursorTrack: (e: React.PointerEvent) => void,
    clearCursor: () => void,
    statusMode: CanvasStatusMode,
  ) {
    const canvasEl = refEl ?? activeCanvasRef.current ?? cursor.cursorCanvasRef.current;
    if (isInWorkspaceBounds(e, canvasEl)) {
      cursorTrack(e);
    } else {
      clearCursor();
    }
    updateStatus(e, canvasEl, statusMode);
    if (panningRef.current) {
      s.current.movePan(e);
      return;
    }
    if (!drawingRef.current) return;
    const st = strokeRef.current;
    if (!st || st.params.tool === "fill") return;
    e.preventDefault();
    const sp = st.params;
    const workingData = st.workingData;
    const lv = resolveLevel(sp.tool, sp.brushLevel);
    const cv = canvasDataRef.current;
    const W = cv.width,
      H = cv.height;

    if (isShapeTool(sp.tool)) {
      const pos = canvasPosUnclamped(e, canvasEl, zoomRef.current, panRef.current, cv);
      const origin = st.shapeStart || pos;
      const { shapeBBox: newBB, dirtyBBox: dirtyBB } = applyShapeStroke(
        workingData,
        st.beforeData,
        sp.tool,
        origin,
        pos,
        sp.brushSize,
        lv,
        W,
        H,
        st.prevShapeBBox,
      );
      st.prevShapeBBox = newBB;
      lastRef.current = pos;
      renderCanvasBuffers(
        workingData,
        W,
        H,
        s.current.colorLUT,
        sourceCanvasRef.current,
        previewCanvasRef.current,
        imgCacheRef.current,
        dirtyBB,
      );
      return;
    }

    // Brush / eraser: keep true canvas-space positions, including samples
    // outside the canvas. Paint kernels clip to the buffer, which avoids edge
    // clamping while keeping strokes continuous when the pointer re-enters.
    const nativeEvent = e.nativeEvent;
    const zoom = zoomRef.current,
      pan = panRef.current;
    const coalesced = typeof nativeEvent.getCoalescedEvents === "function" ? nativeEvent.getCoalescedEvents() : [];
    const events: Array<{ clientX: number; clientY: number } & PointerPressureSample> = coalesced.length > 0 ? coalesced : [nativeEvent];

    let last = lastRef.current;
    let dirtyBB: DirtyRect | null = null;
    for (const ev of events) {
      const raw = canvasPosUnclamped(ev, canvasEl, zoom, pan, cv);
      const useRaw = forceRawNextMoveRef.current;
      if (useRaw) forceRawNextMoveRef.current = false;
      const p = useRaw || !strokeSmootherRef.current ? raw : smoothStrokePoint(strokeSmootherRef.current, raw);
      if (useRaw && strokeSmootherRef.current) {
        strokeSmootherRef.current.x = raw.x;
        strokeSmootherRef.current.y = raw.y;
      }
      const effectiveBrushSize = pressureAdjustedBrushSize(sp.brushSize, ev);
      const bb = last
        ? applyBrushStroke(workingData, last, p, effectiveBrushSize, lv, W, H)
        : applyBrushDot(workingData, p, effectiveBrushSize, lv, W, H);
      dirtyBB = unionBBox(dirtyBB, bb);
      last = p;
    }
    lastRef.current = last;

    if (!dirtyBB) return;

    queueBrushRender(workingData, W, H, dirtyBB);
  }

  const onDown = useCallback((e: React.PointerEvent) => {
    doDown(e, cursor.cursorCanvasRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doDown reads from sync refs, cursor.cursorCanvasRef is stable
  }, []);

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      doMove(e, cursor.cursorCanvasRef.current, cursor.trackCursor, cursor.clearCursor, "source");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doMove reads from sync refs, cursor.cursorCanvasRef is stable
    [cursor.trackCursor, cursor.clearCursor],
  );

  const onPreviewPointerDown = useCallback((e: React.PointerEvent) => {
    doDown(e, cursor.previewCursorRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doDown reads from sync refs, cursor.previewCursorRef is stable
  }, []);

  const onPreviewPointerMove = useCallback(
    (e: React.PointerEvent) => {
      doMove(e, cursor.previewCursorRef.current, cursor.trackPreviewCursor, cursor.clearPreviewCursor, "color");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doMove reads from sync refs, cursor.previewCursorRef is stable
    [cursor.trackPreviewCursor, cursor.clearPreviewCursor],
  );

  function finishStroke() {
    // Flush pending brush render
    if (paintRafRef.current !== null) {
      cancelAnimationFrame(paintRafRef.current);
      paintRafRef.current = null;
      pendingPaintDirtyRef.current = null;
      paintFrameRef.current = null;
      const st2 = strokeRef.current;
      if (st2)
        renderCanvasBuffers(
          st2.workingData,
          canvasDataRef.current.width,
          canvasDataRef.current.height,
          s.current.colorLUT,
          sourceCanvasRef.current,
          previewCanvasRef.current,
          imgCacheRef.current,
        );
    }
    const st = strokeRef.current;
    if (drawingRef.current && st) {
      const finalData = new Uint8Array(st.workingData);
      const diff = st.beforeData ? computeStrokeResult(st.beforeData, finalData, st.fillChangedIndices) : null;
      dispatch({ type: "stroke_end", finalLevelData: finalData, diff });
    }
    drawingRef.current = false;
    lastRef.current = null;
    strokeSmootherRef.current = null;
    forceRawNextMoveRef.current = false;
    strokeRef.current = null;
    activeCanvasRef.current = null;
  }

  const onUp = useCallback(() => {
    pendingWorkspaceStartRef.current = null;
    if (panningRef.current) {
      s.current.endPan();
      return;
    }
    if (fillPendingRef.current) {
      pendingUpRef.current = true;
      return;
    }
    finishStroke();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable, read via .current
  }, [dispatch]);

  function hasPointerCapture(e: React.PointerEvent, refs: Array<HTMLElement | null>) {
    const candidates = [e.currentTarget as HTMLElement | null, e.target as HTMLElement | null, ...refs];
    for (const el of candidates) {
      if (!el || typeof el.hasPointerCapture !== "function") continue;
      try {
        if (el.hasPointerCapture(e.pointerId)) return true;
      } catch (err) {
        console.warn("CHROMALUM: pointerCapture check failed:", err);
      }
    }
    return false;
  }

  const onWorkspaceDown = useCallback(
    (e: React.PointerEvent) => {
      doWorkspaceDown(e, cursor.cursorCanvasRef.current, cursor.trackCursor, cursor.clearCursor, "source");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doWorkspaceDown reads from sync refs, cursor.cursorCanvasRef is stable
    [cursor.trackCursor, cursor.clearCursor],
  );

  const onWorkspaceMove = useCallback(
    (e: React.PointerEvent) => {
      doWorkspaceMove(e, cursor.cursorCanvasRef.current, cursor.trackCursor, cursor.clearCursor, "source");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doWorkspaceMove reads from sync refs, cursor.cursorCanvasRef is stable
    [cursor.trackCursor, cursor.clearCursor],
  );

  const onWorkspaceLeave = useCallback(
    (e: React.PointerEvent) => {
      if (pendingWorkspaceStartRef.current) {
        pendingWorkspaceStartRef.current = null;
        cursor.clearCursor();
        return;
      }
      if (drawingRef.current && hasPointerCapture(e, [sourceCanvasRef.current])) {
        cursor.clearCursor();
        return;
      }
      onUp();
      cursor.clearCursor();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hasPointerCapture reads event/current refs only
    [onUp, cursor.clearCursor],
  );

  const onPreviewWorkspacePointerDown = useCallback(
    (e: React.PointerEvent) => {
      doWorkspaceDown(e, cursor.previewCursorRef.current, cursor.trackPreviewCursor, cursor.clearPreviewCursor, "color");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doWorkspaceDown reads from sync refs, cursor.previewCursorRef is stable
    [cursor.trackPreviewCursor, cursor.clearPreviewCursor],
  );

  const onPreviewWorkspacePointerMove = useCallback(
    (e: React.PointerEvent) => {
      doWorkspaceMove(e, cursor.previewCursorRef.current, cursor.trackPreviewCursor, cursor.clearPreviewCursor, "color");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doWorkspaceMove reads from sync refs, cursor.previewCursorRef is stable
    [cursor.trackPreviewCursor, cursor.clearPreviewCursor],
  );

  const onWorkspaceLeavePrv = useCallback(
    (e: React.PointerEvent) => {
      if (pendingWorkspaceStartRef.current) {
        pendingWorkspaceStartRef.current = null;
        cursor.clearPreviewCursor();
        return;
      }
      if (drawingRef.current && hasPointerCapture(e, [previewCanvasRef.current])) {
        cursor.clearPreviewCursor();
        return;
      }
      onUp();
      cursor.clearPreviewCursor();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hasPointerCapture reads event/current refs only
    [onUp, cursor.clearPreviewCursor, previewCanvasRef],
  );

  return {
    sourceCanvasRef,
    cursorCanvasRef: cursor.cursorCanvasRef,
    previewCursorRef: cursor.previewCursorRef,
    statusRef,
    imgCacheRef,
    strokeRef,
    drawingRef,
    lastRef,
    cursorRafRef: cursor.cursorRafRef,
    scheduleCursorRedrawRef: cursor.scheduleCursorRedrawRef,
    cursorPosRef: cursor.cursorPosRef,
    onDown,
    onMove,
    onUp,
    onWorkspaceDown,
    onWorkspaceMove,
    onWorkspaceLeave,
    trackCursor: cursor.trackCursor,
    clearCursor: cursor.clearCursor,
    onPreviewPointerDown,
    onPreviewPointerMove,
    onPreviewWorkspacePointerDown,
    onPreviewWorkspacePointerMove,
    onWorkspaceLeavePrv,
    trackPreviewCursor: cursor.trackPreviewCursor,
    clearPreviewCursor: cursor.clearPreviewCursor,
  };
}
