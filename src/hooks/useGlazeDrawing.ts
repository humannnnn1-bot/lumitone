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
import { renderBuf } from "../drawing/render-buf";
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
  cvs: CanvasData;
  dispatch: React.Dispatch<CanvasAction>;
  colorLUT: [number, number, number][];
  cc: number[];
  hueAngle: number;
  setHueAngle: React.Dispatch<React.SetStateAction<number>>;
  glazeTool: GlazeToolId;
  brushSize: number;
  prvRef: React.MutableRefObject<HTMLCanvasElement | null>;
  directCandidates: Map<number, number>;
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
  cmBuf: Uint8Array;
  cmPre: Uint8Array;
  fillChanged: Uint32Array | null;
  glazeLUT: Uint8Array;
}

export function useGlazeDrawing(opts: GlazeDrawingOptions): GlazeDrawingResult {
  const { cvs, dispatch, colorLUT, cc, hueAngle, setHueAngle, glazeTool, brushSize, prvRef, directCandidates } = opts;
  const ctx = useDrawingContext();
  const { displayW, displayH, panningRef, spaceRef, zoomRef, panRef, startPan, movePan, endPan, announce, t } = ctx;

  const srcRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const imgCacheRef = useRef<ImgCache>({ src: null, prv: null, s32: null, p32: null });
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const strokeSmootherRef = useRef<StrokeSmoother | null>(null);
  const forceRawNextMoveRef = useRef(false);
  const strokeRef = useRef<GlazeStroke | null>(null);
  // Buffer pool: reuse cmPre/cmBuf allocations across strokes
  const cmPoolRef = useRef<{ cmPre: Uint8Array | null; cmBuf: Uint8Array | null; size: number }>({ cmPre: null, cmBuf: null, size: 0 });
  const paintRafRef = useRef<number | null>(null);
  const pendingPaintDirtyRef = useRef<DirtyRect | null>(null);
  const paintFrameRef = useRef<{
    data: Uint8Array;
    colorMap: Uint8Array;
    w: number;
    h: number;
    lut: [number, number, number][];
    srcCanvas: HTMLCanvasElement | null;
    prvCanvas: HTMLCanvasElement | null;
    imgCache: ImgCache;
  } | null>(null);
  const fillPendingRef = useRef(false);
  const pendingUpRef = useRef(false);
  const pendingWorkspaceStartRef = useRef<{ startPos: Point } | null>(null);
  const floodFillWorker = useFloodFillWorker();

  // Refs needed by useCursorOverlay (individual for interface compatibility)
  const brushSizeRef = useSyncRef(brushSize);
  const cvsRef = useSyncRef(cvs);
  const displayWRef = useSyncRef(displayW);
  const displayHRef = useSyncRef(displayH);
  const toolRef = useSyncRef(
    glazeTool === "glaze_brush" ? ("brush" as const) : glazeTool === "glaze_eraser" ? ("eraser" as const) : ("fill" as const),
  );

  // Batch-sync remaining values used in imperative callbacks
  const s = useSyncRefs({ colorLUT, cc, hueAngle, setHueAngle, glazeTool, startPan, movePan, endPan, announce, t, directCandidates });

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
    updateStatusBase(e, statusRef.current, cursor.curRef.current, drawRefs, cvsRef.current.data, (pos, lv, _info, idx) => {
      const cm = drawingRef.current && strokeRef.current ? strokeRef.current.cmBuf[idx] : cvsRef.current.colorMap[idx];
      return formatGlazePixelStatus({
        x: pos.x,
        y: pos.y,
        lv,
        cc: s.current.cc,
        colorMapValue: cm,
        hueAngle: s.current.hueAngle,
        directCandidates: s.current.directCandidates,
        glazeTool: s.current.glazeTool,
      });
    });
  }

  function queueGlazeRender(data: Uint8Array, colorMap: Uint8Array, W: number, H: number, dirtyBB: DirtyRect) {
    pendingPaintDirtyRef.current = unionBBox(pendingPaintDirtyRef.current, dirtyBB);
    paintFrameRef.current = {
      data,
      colorMap,
      w: W,
      h: H,
      lut: s.current.colorLUT,
      srcCanvas: srcRef.current,
      prvCanvas: prvRef.current,
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
        renderBuf(frame.data, frame.w, frame.h, frame.lut, frame.srcCanvas, frame.prvCanvas, frame.imgCache, dirtySnap, frame.colorMap);
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
    const pc = prvRef.current;
    if (pc && (pc.width !== cv.w || pc.height !== cv.h)) {
      pc.width = cv.w;
      pc.height = cv.h;
      imgCacheRef.current = { src: null, prv: null, s32: null, p32: null };
    }
    const n = cv.colorMap.length;
    const pool = cmPoolRef.current;
    if (!pool.cmPre || !pool.cmBuf || pool.size !== n) {
      pool.cmPre = new Uint8Array(n);
      pool.cmBuf = new Uint8Array(n);
      pool.size = n;
    }
    pool.cmPre.set(cv.colorMap);
    pool.cmBuf.set(cv.colorMap);
    const cmPre: Uint8Array = pool.cmPre;
    const cmBuf: Uint8Array = pool.cmBuf;
    const dc = new Map(s.current.directCandidates);
    const isDirect = dc.size > 0;
    const curHue = s.current.hueAngle;
    const glazeLUT = isDirect ? buildMultiDirectLUT(dc) : buildGlazeLUT(curHue);
    strokeRef.current = { cmBuf, cmPre, fillChanged: null, glazeLUT };
    const curTool = s.current.glazeTool;
    strokeSmootherRef.current = curTool === "glaze_fill" ? null : createStrokeSmoother(pos);
    forceRawNextMoveRef.current = startPos !== undefined && !isCanvasPointInBounds(startPos, cvsRef.current);
    const mask = getBrushMask(pressureAdjustedBrushSize(brushSizeRef.current, e.nativeEvent));
    const W = cv.w,
      H = cv.h;

    if (curTool === "glaze_fill") {
      const seedIdx = pos.y * W + pos.x;
      const seedLv = cv.data[seedIdx] & LEVEL_MASK;
      // In direct mode, only fill if seed pixel's level is in the direct map
      if (isDirect && !dc.has(seedLv)) {
        drawingRef.current = false;
        strokeRef.current = null;
        return;
      }
      const newCmVal = isDirect ? dc.get(seedLv)! + 1 : findClosestCandidate(seedLv, curHue) + 1;
      fillPendingRef.current = true;
      floodFillWorker
        .requestGlazeFill(cv.data, cmBuf, pos.x, pos.y, newCmVal, W, H)
        .then((res) => {
          const st = strokeRef.current;
          if (!st) {
            fillPendingRef.current = false;
            return;
          }
          st.cmBuf.set(res.colorMap);
          if (res.changed.length > 0) {
            st.fillChanged = res.changed;
            if (res.truncated) s.current.announce(s.current.t("toast_fill_truncated"));
          }
          const dirtyBB = st.fillChanged ? dirtyFromChanged(st.fillChanged, W, H) : undefined;
          renderBuf(cv.data, W, H, s.current.colorLUT, srcRef.current, prvRef.current, imgCacheRef.current, dirtyBB, st.cmBuf);
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
      eraseGlazeBrush(cmBuf, pos.x, pos.y, mask, W, H);
    } else {
      paintGlazeBrush(cmBuf, cv.data, pos.x, pos.y, mask, W, H, glazeLUT);
    }
    const dirtyBB = brushMaskBBox([[pos.x, pos.y]], mask, W, H);
    if (dirtyBB) renderBuf(cv.data, W, H, s.current.colorLUT, srcRef.current, prvRef.current, imgCacheRef.current, dirtyBB, cmBuf);
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
    const cmBuf = st.cmBuf;
    const cv = cvsRef.current;
    const W = cv.w,
      H = cv.h;
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
        if (last) eraseGlazeBrushLine(cmBuf, last.x, last.y, p.x, p.y, mask, W, H);
        else eraseGlazeBrush(cmBuf, p.x, p.y, mask, W, H);
      } else {
        if (last) paintGlazeBrushLine(cmBuf, cv.data, last.x, last.y, p.x, p.y, mask, W, H, st.glazeLUT);
        else paintGlazeBrush(cmBuf, cv.data, p.x, p.y, mask, W, H, st.glazeLUT);
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

    queueGlazeRender(cv.data, cmBuf, W, H, dirtyBB);
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
        renderBuf(cv.data, cv.w, cv.h, s.current.colorLUT, srcRef.current, prvRef.current, imgCacheRef.current, undefined, st2.cmBuf);
    }
    const st = strokeRef.current;
    if (drawingRef.current && st) {
      const cv = cvsRef.current;
      const diff = st.fillChanged
        ? buildDiffFromGlazeFill(st.cmPre, st.cmBuf, cv.data, st.fillChanged)
        : computeGlazeDiff(st.cmPre, st.cmBuf, cv.data);
      dispatch({ type: "stroke_end", finalData: cv.data, finalColorMap: new Uint8Array(st.cmBuf), diff });
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
    const idx = pos.y * cv.w + pos.x;
    const lv = cv.data[idx] & LEVEL_MASK;
    // L0 (black) and L7 (white) are achromatic — no hue to pick
    if (lv === 0 || lv === 7) {
      s.current.announce(s.current.t("announce_hue_achromatic"));
      return;
    }
    const cm = cv.colorMap[idx];
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
