import { useRef, useCallback } from "react";
import { LEVEL_MASK } from "../constants";
import type { GlazeToolId } from "../constants";
import { LEVEL_CANDIDATES, findClosestCandidate, rgb2hue } from "../color-engine";
import {
  buildGlazeLUT,
  buildMultiDirectLUT,
  paintGlazeBrush,
  paintGlazeBrushLine,
  eraseGlazeBrush,
  eraseGlazeBrushLine,
} from "../drawing/glaze-paint";
import { dirtyFromChanged, unionBBox } from "../drawing/dirty-rect";
import { brushMaskBBox, getBrushMask } from "../drawing/brush-mask";
import { computeGlazeDiff, buildDiffFromGlazeFill } from "../state/undo-diff";
import { useFloodFillWorker } from "./useFloodFillWorker";
import { renderCanvasBuffers } from "../drawing/render-buf";
import { formatGlazePixelStatus } from "../utils/pixel-status";
import { useSyncRef, useSyncRefs } from "./useSyncRef";
import { useCursorOverlay } from "./useCursorOverlay";
import { trySetPointerCapture, cPosFromRefs, canvasPosUnclamped, isCanvasPointInBounds, updateStatusBase } from "./useDrawingBase";
import type { DrawingRefs } from "./useDrawingBase";
import { createStrokeSmoother, smoothStrokePoint } from "../drawing/stroke-smoothing";
import type { StrokeSmoother } from "../drawing/stroke-smoothing";
import { pressureAdjustedBrushSize } from "../drawing/stroke-pressure";
import type { PointerPressureSample } from "../drawing/stroke-pressure";
import type { CanvasData, ImgCache, CanvasAction, DirtyRect, Point } from "../types";
import { useDrawingContext } from "../state/DrawingContext";

interface GlazeDrawingOptions {
  canvasData: CanvasData;
  dispatch: React.Dispatch<CanvasAction>;
  colorLUT: [number, number, number][];
  candidateIndexByLevel: readonly number[];
  hueAngle: number;
  setHueAngle: React.Dispatch<React.SetStateAction<number>>;
  glazeTool: GlazeToolId;
  brushSize: number;
  prvRef: React.MutableRefObject<HTMLCanvasElement | null>;
  candidateOverridesByLevel: Map<number, number>;
}

export interface GlazeDrawingResult {
  srcRef: React.MutableRefObject<HTMLCanvasElement | null>;
  curRef: React.MutableRefObject<HTMLCanvasElement | null>;
  statusRef: React.MutableRefObject<HTMLDivElement | null>;
  imgCacheRef: React.MutableRefObject<ImgCache>;
  drawingRef: React.MutableRefObject<boolean>;
  cursorRafRef: React.MutableRefObject<number | null>;
  schedCursorRef: React.MutableRefObject<(() => void) | null>;
  cursorPosRef: React.MutableRefObject<{ dx: number; dy: number } | null>;
  onDown: (e: React.PointerEvent) => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: () => void;
  onWorkspaceDown: (e: React.PointerEvent) => void;
  onWorkspaceMove: (e: React.PointerEvent) => void;
  onWorkspaceLeave: (e: React.PointerEvent) => void;
  pickHue: (e: React.PointerEvent) => void;
  trackCursor: (e: React.PointerEvent) => void;
  clearCursor: () => void;
}

interface GlazeStroke {
  workingOverrideMap: Uint8Array;
  beforeOverrideMap: Uint8Array;
  fillChanged: Uint32Array | null;
  glazeLUT: Uint8Array;
}

export function useGlazeDrawing(opts: GlazeDrawingOptions): GlazeDrawingResult {
  const {
    canvasData,
    dispatch,
    colorLUT,
    candidateIndexByLevel,
    hueAngle,
    setHueAngle,
    glazeTool,
    brushSize,
    prvRef,
    candidateOverridesByLevel,
  } = opts;
  const ctx = useDrawingContext();
  const { displayW, displayH, panningRef, spaceRef, zoomRef, panRef, startPan, movePan, endPan, announce, t } = ctx;

  const srcRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const imgCacheRef = useRef<ImgCache>({ sourceImageData: null, previewImageData: null, sourcePixels32: null, previewPixels32: null });
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const strokeSmootherRef = useRef<StrokeSmoother | null>(null);
  const forceRawNextMoveRef = useRef(false);
  const strokeRef = useRef<GlazeStroke | null>(null);
  // Buffer pool: reuse override map allocations across strokes.
  const overrideMapPoolRef = useRef<{ beforeOverrideMap: Uint8Array | null; workingOverrideMap: Uint8Array | null; size: number }>({
    beforeOverrideMap: null,
    workingOverrideMap: null,
    size: 0,
  });
  const paintRafRef = useRef<number | null>(null);
  const pendingPaintDirtyRef = useRef<DirtyRect | null>(null);
  const paintFrameRef = useRef<{
    levelData: Uint8Array;
    pixelCandidateOverrideMap: Uint8Array;
    w: number;
    h: number;
    lut: [number, number, number][];
    sourceCanvas: HTMLCanvasElement | null;
    previewCanvas: HTMLCanvasElement | null;
    imgCache: ImgCache;
  } | null>(null);
  const fillPendingRef = useRef(false);
  const pendingUpRef = useRef(false);
  const pendingWorkspaceStartRef = useRef<{ startPos: Point } | null>(null);
  const floodFillWorker = useFloodFillWorker();

  // Refs needed by useCursorOverlay (individual for interface compatibility)
  const brushSizeRef = useSyncRef(brushSize);
  const cvsRef = useSyncRef(canvasData);
  const displayWRef = useSyncRef(displayW);
  const displayHRef = useSyncRef(displayH);
  const toolRef = useSyncRef(
    glazeTool === "glaze_brush" ? ("brush" as const) : glazeTool === "glaze_eraser" ? ("eraser" as const) : ("fill" as const),
  );

  // Batch-sync remaining values used in imperative callbacks
  const s = useSyncRefs({
    colorLUT,
    candidateIndexByLevel,
    hueAngle,
    setHueAngle,
    glazeTool,
    startPan,
    movePan,
    endPan,
    announce,
    t,
    candidateOverridesByLevel,
  });

  const cursor = useCursorOverlay({ zoomRef, panRef, cvsRef, displayWRef, displayHRef, panningRef, brushSizeRef, toolRef }, statusRef);

  const drawRefs: DrawingRefs = { zoomRef, panRef, cvsRef };

  function cPos(e: React.PointerEvent) {
    return cPosFromRefs(e, cursor.curRef.current, drawRefs);
  }

  function isInCanvasBounds(e: React.PointerEvent) {
    const pos = canvasPosUnclamped(e, cursor.curRef.current, zoomRef.current, panRef.current, cvsRef.current);
    return isCanvasPointInBounds(pos, cvsRef.current);
  }

  function isInWorkspaceBounds(e: React.PointerEvent) {
    const refEl = cursor.curRef.current;
    if (!refEl) return false;
    const r = refEl.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    return e.clientX >= r.left && e.clientX < r.left + r.width && e.clientY >= r.top && e.clientY < r.top + r.height;
  }

  function updateStatus(e: React.PointerEvent) {
    updateStatusBase(e, statusRef.current, cursor.curRef.current, drawRefs, cvsRef.current.levelData, (pos, lv, _info, idx) => {
      const pixelCandidateOverrideValue =
        drawingRef.current && strokeRef.current ? strokeRef.current.workingOverrideMap[idx] : cvsRef.current.pixelCandidateOverrideMap[idx];
      return formatGlazePixelStatus({
        x: pos.x,
        y: pos.y,
        lv,
        candidateIndexByLevel: s.current.candidateIndexByLevel,
        pixelCandidateOverrideValue,
        hueAngle: s.current.hueAngle,
        candidateOverridesByLevel: s.current.candidateOverridesByLevel,
        glazeTool: s.current.glazeTool,
      });
    });
  }

  function queueGlazeRender(levelData: Uint8Array, pixelCandidateOverrideMap: Uint8Array, W: number, H: number, dirtyBB: DirtyRect) {
    pendingPaintDirtyRef.current = unionBBox(pendingPaintDirtyRef.current, dirtyBB);
    paintFrameRef.current = {
      levelData,
      pixelCandidateOverrideMap,
      w: W,
      h: H,
      lut: s.current.colorLUT,
      sourceCanvas: srcRef.current,
      previewCanvas: prvRef.current,
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
          frame.pixelCandidateOverrideMap,
        );
      }
    });
  }

  function doDown(e: React.PointerEvent, buttonOverride?: 0 | 1, startPos?: Point) {
    const button = buttonOverride ?? e.button;
    if (button !== 0 && button !== 1) return;
    e.preventDefault();
    if (drawingRef.current) return;
    if (button === 1 || spaceRef.current) {
      s.current.startPan(e);
      return;
    }
    trySetPointerCapture(e);
    drawingRef.current = true;
    const pos = startPos ?? cPos(e);
    lastRef.current = pos;
    const cv = cvsRef.current;
    // Ensure preview canvas dimensions match
    const previewCanvas = prvRef.current;
    if (previewCanvas && (previewCanvas.width !== cv.width || previewCanvas.height !== cv.height)) {
      previewCanvas.width = cv.width;
      previewCanvas.height = cv.height;
      imgCacheRef.current = { sourceImageData: null, previewImageData: null, sourcePixels32: null, previewPixels32: null };
    }
    const n = cv.pixelCandidateOverrideMap.length;
    const pool = overrideMapPoolRef.current;
    if (!pool.beforeOverrideMap || !pool.workingOverrideMap || pool.size !== n) {
      pool.beforeOverrideMap = new Uint8Array(n);
      pool.workingOverrideMap = new Uint8Array(n);
      pool.size = n;
    }
    pool.beforeOverrideMap.set(cv.pixelCandidateOverrideMap);
    pool.workingOverrideMap.set(cv.pixelCandidateOverrideMap);
    const beforeOverrideMap: Uint8Array = pool.beforeOverrideMap;
    const workingOverrideMap: Uint8Array = pool.workingOverrideMap;
    const nextCandidateOverrides = new Map(s.current.candidateOverridesByLevel);
    const isDirect = nextCandidateOverrides.size > 0;
    const curHue = s.current.hueAngle;
    const glazeLUT = isDirect ? buildMultiDirectLUT(nextCandidateOverrides) : buildGlazeLUT(curHue);
    strokeRef.current = { workingOverrideMap, beforeOverrideMap, fillChanged: null, glazeLUT };
    const curTool = s.current.glazeTool;
    strokeSmootherRef.current = curTool === "glaze_fill" ? null : createStrokeSmoother(pos);
    forceRawNextMoveRef.current = startPos !== undefined && !isCanvasPointInBounds(startPos, cvsRef.current);
    const mask = getBrushMask(pressureAdjustedBrushSize(brushSizeRef.current, e.nativeEvent));
    const W = cv.width,
      H = cv.height;

    if (curTool === "glaze_fill") {
      const seedIdx = pos.y * W + pos.x;
      const seedLv = cv.levelData[seedIdx] & LEVEL_MASK;
      // In direct mode, only fill if seed pixel's level is in the direct map
      if (isDirect && !nextCandidateOverrides.has(seedLv)) {
        drawingRef.current = false;
        strokeRef.current = null;
        return;
      }
      const targetColorOverrideValue = isDirect ? nextCandidateOverrides.get(seedLv)! + 1 : findClosestCandidate(seedLv, curHue) + 1;
      fillPendingRef.current = true;
      floodFillWorker
        .requestGlazeFill(cv.levelData, workingOverrideMap, pos.x, pos.y, targetColorOverrideValue, W, H)
        .then((res) => {
          const st = strokeRef.current;
          if (!st) {
            fillPendingRef.current = false;
            return;
          }
          st.workingOverrideMap.set(res.pixelCandidateOverrideMap);
          if (res.changed.length > 0) {
            st.fillChanged = res.changed;
            if (res.truncated) s.current.announce(s.current.t("toast_fill_truncated"));
          }
          const dirtyBB = st.fillChanged ? dirtyFromChanged(st.fillChanged, W, H) : undefined;
          renderCanvasBuffers(
            cv.levelData,
            W,
            H,
            s.current.colorLUT,
            srcRef.current,
            prvRef.current,
            imgCacheRef.current,
            dirtyBB,
            st.workingOverrideMap,
          );
          fillPendingRef.current = false;
          if (pendingUpRef.current) {
            pendingUpRef.current = false;
            finishGlazeStroke();
          }
        })
        .catch((err) => {
          fillPendingRef.current = false;
          pendingUpRef.current = false;
          strokeRef.current = null;
          drawingRef.current = false;
          s.current.announce(s.current.t("toast_fill_error"));
          console.error("CHROMALUM: glaze flood fill failed:", err);
        });
      return;
    } else if (curTool === "glaze_eraser") {
      eraseGlazeBrush(workingOverrideMap, pos.x, pos.y, mask, W, H);
    } else {
      paintGlazeBrush(workingOverrideMap, cv.levelData, pos.x, pos.y, mask, W, H, glazeLUT);
    }
    const dirtyBB = brushMaskBBox([[pos.x, pos.y]], mask, W, H);
    if (dirtyBB)
      renderCanvasBuffers(
        cv.levelData,
        W,
        H,
        s.current.colorLUT,
        srcRef.current,
        prvRef.current,
        imgCacheRef.current,
        dirtyBB,
        workingOverrideMap,
      );
  }

  function canArmWorkspaceStart(e: React.PointerEvent) {
    return e.button === 0 && !e.altKey && s.current.glazeTool !== "glaze_fill";
  }

  function doWorkspaceDown(e: React.PointerEvent) {
    pendingWorkspaceStartRef.current = null;
    if (e.button === 1 || spaceRef.current || isInCanvasBounds(e)) {
      doDown(e);
      return;
    }
    e.preventDefault();
    if (!isInWorkspaceBounds(e)) {
      cursor.clearCursor();
      return;
    }
    cursor.trackCursor(e);
    updateStatus(e);
    if (!canArmWorkspaceStart(e)) return;
    trySetPointerCapture(e);
    pendingWorkspaceStartRef.current = {
      startPos: canvasPosUnclamped(e, cursor.curRef.current, zoomRef.current, panRef.current, cvsRef.current),
    };
  }

  function doWorkspaceMove(e: React.PointerEvent) {
    const pending = pendingWorkspaceStartRef.current;
    if (pending) {
      e.preventDefault();
      if (isInWorkspaceBounds(e)) {
        cursor.trackCursor(e);
        updateStatus(e);
      } else {
        cursor.clearCursor();
      }
      if ((e.buttons & 1) !== 1) {
        pendingWorkspaceStartRef.current = null;
        cursor.clearCursor();
        return;
      }
      if (!isInCanvasBounds(e)) return;
      pendingWorkspaceStartRef.current = null;
      doDown(e, 0, pending.startPos);
      doMove(e);
      return;
    }
    if (!drawingRef.current && !panningRef.current && !isInCanvasBounds(e)) {
      if (isInWorkspaceBounds(e)) {
        cursor.trackCursor(e);
        updateStatus(e);
      } else {
        cursor.clearCursor();
      }
      return;
    }
    doMove(e);
  }

  function doMove(e: React.PointerEvent) {
    if (isInWorkspaceBounds(e)) {
      cursor.trackCursor(e);
    } else {
      cursor.clearCursor();
    }
    updateStatus(e);
    if (panningRef.current) {
      s.current.movePan(e);
      return;
    }
    if (!drawingRef.current) return;
    const st = strokeRef.current;
    if (!st || s.current.glazeTool === "glaze_fill") return;
    e.preventDefault();
    const workingOverrideMap = st.workingOverrideMap;
    const cv = cvsRef.current;
    const W = cv.width,
      H = cv.height;
    const curTool = s.current.glazeTool;

    // Brush / eraser: keep true canvas-space positions, including samples
    // outside the canvas. Glaze paint functions clip writes to the color map,
    // so re-entry remains continuous without smearing along the nearest edge.
    const nativeEvent = e.nativeEvent;
    const canvasEl = cursor.curRef.current;
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
      const mask = getBrushMask(pressureAdjustedBrushSize(brushSizeRef.current, ev));
      if (curTool === "glaze_eraser") {
        if (last) eraseGlazeBrushLine(workingOverrideMap, last.x, last.y, p.x, p.y, mask, W, H);
        else eraseGlazeBrush(workingOverrideMap, p.x, p.y, mask, W, H);
      } else {
        if (last) paintGlazeBrushLine(workingOverrideMap, cv.levelData, last.x, last.y, p.x, p.y, mask, W, H, st.glazeLUT);
        else paintGlazeBrush(workingOverrideMap, cv.levelData, p.x, p.y, mask, W, H, st.glazeLUT);
      }
      const bb = last
        ? brushMaskBBox(
            [
              [last.x, last.y],
              [p.x, p.y],
            ],
            mask,
            W,
            H,
          )
        : brushMaskBBox([[p.x, p.y]], mask, W, H);
      dirtyBB = unionBBox(dirtyBB, bb);
      last = p;
    }
    lastRef.current = last;

    if (!dirtyBB) return;

    queueGlazeRender(cv.levelData, workingOverrideMap, W, H, dirtyBB);
  }

  const onDown = useCallback((e: React.PointerEvent) => {
    doDown(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doDown reads from sync refs
  }, []);

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      doMove(e);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doMove reads from sync refs
    [cursor.trackCursor],
  );

  function finishGlazeStroke() {
    // Flush pending glaze render
    if (paintRafRef.current !== null) {
      cancelAnimationFrame(paintRafRef.current);
      paintRafRef.current = null;
      pendingPaintDirtyRef.current = null;
      paintFrameRef.current = null;
      const cv = cvsRef.current;
      const st2 = strokeRef.current;
      if (st2)
        renderCanvasBuffers(
          cv.levelData,
          cv.width,
          cv.height,
          s.current.colorLUT,
          srcRef.current,
          prvRef.current,
          imgCacheRef.current,
          undefined,
          st2.workingOverrideMap,
        );
    }
    const st = strokeRef.current;
    if (drawingRef.current && st) {
      const cv = cvsRef.current;
      const diff = st.fillChanged
        ? buildDiffFromGlazeFill(st.beforeOverrideMap, st.workingOverrideMap, cv.levelData, st.fillChanged)
        : computeGlazeDiff(st.beforeOverrideMap, st.workingOverrideMap, cv.levelData);
      dispatch({
        type: "stroke_end",
        finalLevelData: cv.levelData,
        finalPixelCandidateOverrideMap: new Uint8Array(st.workingOverrideMap),
        diff,
      });
    }
    drawingRef.current = false;
    lastRef.current = null;
    strokeSmootherRef.current = null;
    forceRawNextMoveRef.current = false;
    strokeRef.current = null;
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
    finishGlazeStroke();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable, read via .current
  }, [dispatch]);

  function hasPointerCapture(e: React.PointerEvent) {
    const candidates = [e.currentTarget as HTMLElement | null, e.target as HTMLElement | null, prvRef.current];
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

  const onWorkspaceDown = useCallback((e: React.PointerEvent) => {
    doWorkspaceDown(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doWorkspaceDown reads from sync refs
  }, []);

  const onWorkspaceMove = useCallback((e: React.PointerEvent) => {
    doWorkspaceMove(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doWorkspaceMove reads from sync refs
  }, []);

  const onWorkspaceLeave = useCallback(
    (e: React.PointerEvent) => {
      if (pendingWorkspaceStartRef.current) {
        pendingWorkspaceStartRef.current = null;
        cursor.clearCursor();
        return;
      }
      if (drawingRef.current && hasPointerCapture(e)) {
        cursor.clearCursor();
        return;
      }
      onUp();
      cursor.clearCursor();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hasPointerCapture reads event/current refs only
    [onUp, cursor.clearCursor],
  );

  /** Eyedropper: pick hue from any pixel (glazed or default). */
  const pickHue = useCallback((e: React.PointerEvent) => {
    const cv = cvsRef.current;
    const pos = canvasPosUnclamped(e, cursor.curRef.current, zoomRef.current, panRef.current, cv);
    if (!isCanvasPointInBounds(pos, cv)) return;
    const idx = pos.y * cv.width + pos.x;
    const lv = cv.levelData[idx] & LEVEL_MASK;
    // L0 (black) and L7 (white) are achromatic — no hue to pick
    if (lv === 0 || lv === 7) {
      s.current.announce(s.current.t("announce_hue_achromatic"));
      return;
    }
    const cm = cv.pixelCandidateOverrideMap[idx];
    let angle: number;
    if (cm > 0) {
      // Glazed pixel: pick from candidate's stored angle
      const candidates = LEVEL_CANDIDATES[lv];
      const ci = (cm - 1) % candidates.length;
      angle = candidates[ci]?.angle ?? 0;
    } else {
      // Default pixel: derive hue from colorLUT
      const rgb = s.current.colorLUT[lv];
      angle = rgb2hue(rgb[0], rgb[1], rgb[2]);
    }
    s.current.setHueAngle(angle);
    s.current.announce(s.current.t("announce_hue_picked", Math.round(angle)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- all values read from sync refs
  }, []);

  return {
    srcRef,
    curRef: cursor.curRef,
    statusRef,
    imgCacheRef,
    drawingRef,
    cursorRafRef: cursor.cursorRafRef,
    schedCursorRef: cursor.schedCursorRef,
    cursorPosRef: cursor.cursorPosRef,
    onDown,
    onMove,
    onUp,
    onWorkspaceDown,
    onWorkspaceMove,
    onWorkspaceLeave,
    pickHue,
    trackCursor: cursor.trackCursor,
    clearCursor: cursor.clearCursor,
  };
}
