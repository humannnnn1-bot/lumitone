import { useRef, useCallback } from "react";
import { LEVEL_MASK } from "../constants";
import type { GlazeToolId } from "../constants";
import { LEVEL_CANDIDATES, findClosestCandidate, rgb2hue } from "../color-engine";
import { buildGlazeLUT, buildMultiDirectLUT, paintGlazeCircle, paintGlazeLine, eraseGlazeCircle, eraseGlazeLine } from "../glaze-paint";
import { brushBBox, dirtyFromChanged, shapeBBox, unionBBox, restoreRect } from "../dirty-rect";
import { computeGlazeDiff, buildDiffFromGlazeFill } from "../undo-diff";
import { useFloodFillWorker } from "./useFloodFillWorker";
import { renderBuf } from "../render-buf";
import { hexStr } from "../utils";
import { useSyncRef, useSyncRefs } from "./useSyncRef";
import { useCursorOverlay } from "./useCursorOverlay";
import { trySetPointerCapture, cPosFromRefs, updateStatusBase } from "./useDrawingBase";
import type { DrawingRefs } from "./useDrawingBase";
import type { CanvasData, ImgCache, CanvasAction, DirtyRect } from "../types";
import { useDrawingContext } from "../contexts/DrawingContext";

export interface GlazeDrawingOptions {
  cvs: CanvasData;
  dispatch: React.Dispatch<CanvasAction>;
  colorLUT: [number, number, number][];
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
  pickHue: (e: React.PointerEvent) => void;
  trackCursor: (e: React.PointerEvent) => void;
  clearCursor: () => void;
}

interface GlazeStroke {
  cmBuf: Uint8Array;
  cmPre: Uint8Array;
  fillChanged: Uint32Array | null;
  glazeLUT: Uint8Array;
  shapeStart: { x: number; y: number } | null;
  prevShapeBBox: DirtyRect | null;
}

export function useGlazeDrawing(opts: GlazeDrawingOptions): GlazeDrawingResult {
  const {
    cvs, dispatch, colorLUT,
    hueAngle, setHueAngle, glazeTool, brushSize,
    prvRef,
    directCandidates,
  } = opts;
  const ctx = useDrawingContext();
  const { displayW, displayH, panningRef, spaceRef, zoomRef, panRef, startPan, movePan, endPan, announce, t } = ctx;

  const srcRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const imgCacheRef = useRef<ImgCache>({ src: null, prv: null, s32: null, p32: null });
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const strokeRef = useRef<GlazeStroke | null>(null);
  // Buffer pool: reuse cmPre/cmBuf allocations across strokes
  const cmPoolRef = useRef<{ cmPre: Uint8Array | null; cmBuf: Uint8Array | null; size: number }>({ cmPre: null, cmBuf: null, size: 0 });
  const paintRafRef = useRef<number | null>(null);
  const fillPendingRef = useRef(false);
  const pendingUpRef = useRef(false);
  const floodFillWorker = useFloodFillWorker();

  // Refs needed by useCursorOverlay (individual for interface compatibility)
  const brushSizeRef = useSyncRef(brushSize);
  const cvsRef = useSyncRef(cvs);
  const displayWRef = useSyncRef(displayW);
  const displayHRef = useSyncRef(displayH);
  const toolRef = useSyncRef(glazeTool === "glaze_brush" ? "brush" as const : glazeTool === "glaze_eraser" ? "eraser" as const : "fill" as const);

  // Batch-sync remaining values used in imperative callbacks
  const s = useSyncRefs({ colorLUT, hueAngle, setHueAngle, glazeTool, startPan, movePan, endPan, announce, t, directCandidates });

  const cursor = useCursorOverlay(
    { zoomRef, panRef, cvsRef, displayWRef, displayHRef, panningRef, brushSizeRef, toolRef },
    statusRef,
  );

  const drawRefs: DrawingRefs = { zoomRef, panRef, cvsRef };

  function cPos(e: React.PointerEvent) {
    return cPosFromRefs(e, cursor.curRef.current, drawRefs);
  }

  function updateStatus(e: React.PointerEvent) {
    updateStatusBase(
      e, statusRef.current, cursor.curRef.current, drawRefs, cvsRef.current.data,
      (pos, lv, info, idx) => {
        const cm = drawingRef.current && strokeRef.current ? strokeRef.current.cmBuf[idx] : cvsRef.current.colorMap[idx];
        const cmLabel = cm > 0 ? `Glaze:${cm}` : "Default";
        const alts = LEVEL_CANDIDATES[lv];
        const ci = cm > 0 ? (cm - 1) % alts.length : -1;
        const colorHex = ci >= 0 ? hexStr(alts[ci].rgb) : "";
        return `(${pos.x}, ${pos.y})  L${lv} ${info.name}  ${cmLabel} ${colorHex}`;
      },
    );
  }


  function doDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    if (drawingRef.current) return;
    if (e.button === 1 || spaceRef.current) { s.current.startPan(e); return; }
    trySetPointerCapture(e);
    drawingRef.current = true;
    const pos = cPos(e);
    lastRef.current = pos;
    const cv = cvsRef.current;
    // Ensure preview canvas dimensions match
    const pc = prvRef.current;
    if (pc && (pc.width !== cv.w || pc.height !== cv.h)) {
      pc.width = cv.w; pc.height = cv.h;
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
    strokeRef.current = { cmBuf, cmPre, fillChanged: null, glazeLUT, shapeStart: pos, prevShapeBBox: null };
    const curTool = s.current.glazeTool;
    const r = Math.floor(brushSizeRef.current / 2);
    const W = cv.w, H = cv.h;

    if (curTool === "glaze_fill") {
      const seedIdx = pos.y * W + pos.x;
      const seedLv = cv.data[seedIdx] & LEVEL_MASK;
      // In direct mode, only fill if seed pixel's level is in the direct map
      if (isDirect && !dc.has(seedLv)) { drawingRef.current = false; strokeRef.current = null; return; }
      const newCmVal = isDirect ? (dc.get(seedLv)! + 1) : (findClosestCandidate(seedLv, curHue) + 1);
      fillPendingRef.current = true;
      floodFillWorker.requestGlazeFill(cv.data, cmBuf, pos.x, pos.y, newCmVal, W, H).then((res) => {
        const st = strokeRef.current;
        if (!st) { fillPendingRef.current = false; return; }
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
      }).catch((err) => {
        fillPendingRef.current = false;
        pendingUpRef.current = false;
        strokeRef.current = null;
        drawingRef.current = false;
        s.current.announce(s.current.t("toast_fill_error"));
        console.error("CHROMALUM: glaze flood fill failed:", err);
      });
      return;
    } else if (curTool === "glaze_eraser") {
      eraseGlazeCircle(cmBuf, pos.x, pos.y, r, W, H);
    } else {
      paintGlazeCircle(cmBuf, cv.data, pos.x, pos.y, r, W, H, glazeLUT);
    }
    const dirtyBB = brushBBox([[pos.x, pos.y]], r, W, H);
    renderBuf(cv.data, W, H, s.current.colorLUT, srcRef.current, prvRef.current, imgCacheRef.current, dirtyBB, cmBuf);
  }

  function doMove(e: React.PointerEvent) {
    cursor.trackCursor(e); updateStatus(e);
    if (panningRef.current) { s.current.movePan(e); return; }
    if (!drawingRef.current) return;
    const st = strokeRef.current;
    if (!st || s.current.glazeTool === "glaze_fill") return;
    e.preventDefault();
    const pos = cPos(e), last = lastRef.current || pos;
    const cmBuf = st.cmBuf;
    const cv = cvsRef.current;
    const r = Math.floor(brushSizeRef.current / 2);
    const W = cv.w, H = cv.h;
    const curTool = s.current.glazeTool;

    // Shape tools: restore only the dirty region from cmPre, then redraw shape
    if (st.shapeStart && curTool !== "glaze_brush" && curTool !== "glaze_eraser") {
      const origin = st.shapeStart;
      const newBB = shapeBBox(origin.x, origin.y, pos.x, pos.y, r, W, H);
      const prevBB = st.prevShapeBBox;
      const dirtyBB = unionBBox(prevBB, newBB);
      if (dirtyBB) restoreRect(cmBuf, st.cmPre, W, dirtyBB);
      // Future: paint glaze shape here
      st.prevShapeBBox = newBB;
      lastRef.current = pos;
      renderBuf(cv.data, W, H, s.current.colorLUT, srcRef.current, prvRef.current, imgCacheRef.current, dirtyBB, cmBuf);
      return;
    }

    // Brush / eraser: incremental paint, no restoration needed
    if (curTool === "glaze_eraser") {
      eraseGlazeLine(cmBuf, last.x, last.y, pos.x, pos.y, r, W, H);
    } else {
      paintGlazeLine(cmBuf, cv.data, last.x, last.y, pos.x, pos.y, r, W, H, st.glazeLUT);
    }
    const allPts: [number, number][] = [[last.x, last.y], [pos.x, pos.y]];
    const dirtyBB = brushBBox(allPts, r, W, H);
    lastRef.current = pos;
    // Throttle rendering to animation frame rate
    if (paintRafRef.current !== null) cancelAnimationFrame(paintRafRef.current);
    const lutSnap = s.current.colorLUT, srcSnap = srcRef.current, prvSnap = prvRef.current, cacheSnap = imgCacheRef.current;
    const dataSnap = cv.data;
    paintRafRef.current = requestAnimationFrame(() => {
      paintRafRef.current = null;
      renderBuf(dataSnap, W, H, lutSnap, srcSnap, prvSnap, cacheSnap, dirtyBB, cmBuf);
    });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- doDown/doMove read from sync refs
  const onDown = useCallback((e: React.PointerEvent) => { doDown(e); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onMove = useCallback((e: React.PointerEvent) => { doMove(e); }, [cursor.trackCursor]);

  function finishGlazeStroke() {
    // Flush pending glaze render
    if (paintRafRef.current !== null) {
      cancelAnimationFrame(paintRafRef.current);
      paintRafRef.current = null;
      const cv = cvsRef.current;
      const st2 = strokeRef.current;
      if (st2) renderBuf(cv.data, cv.w, cv.h, s.current.colorLUT, srcRef.current, prvRef.current, imgCacheRef.current, undefined, st2.cmBuf);
    }
    const st = strokeRef.current;
    if (drawingRef.current && st) {
      const cv = cvsRef.current;
      const diff = st.fillChanged
        ? buildDiffFromGlazeFill(st.cmPre, st.cmBuf, cv.data, st.fillChanged)
        : computeGlazeDiff(st.cmPre, st.cmBuf, cv.data);
      dispatch({ type: "stroke_end", finalData: cv.data, finalColorMap: new Uint8Array(st.cmBuf), diff });
    }
    drawingRef.current = false; lastRef.current = null;
    strokeRef.current = null;
  }

  const onUp = useCallback(() => {
    if (panningRef.current) { s.current.endPan(); return; }
    if (fillPendingRef.current) { pendingUpRef.current = true; return; }
    finishGlazeStroke();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable, read via .current
  }, [dispatch]);

  /** Eyedropper: pick hue from any pixel (glazed or default). */
  const pickHue = useCallback((e: React.PointerEvent) => {
    const pos = cPos(e);
    const cv = cvsRef.current;
    if (pos.x < 0 || pos.x >= cv.w || pos.y < 0 || pos.y >= cv.h) return;
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
    srcRef, curRef: cursor.curRef, statusRef, imgCacheRef,
    drawingRef, cursorRafRef: cursor.cursorRafRef,
    schedCursorRef: cursor.schedCursorRef, cursorPosRef: cursor.cursorPosRef,
    onDown, onMove, onUp, pickHue,
    trackCursor: cursor.trackCursor, clearCursor: cursor.clearCursor,
  };
}
