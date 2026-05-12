import { useEffect, useLayoutEffect, useCallback } from "react";
import { renderCanvasBuffers } from "../drawing/render-buf";
import type { CanvasData } from "../types";
import type { MainTabId } from "../tabs";
import type { CanvasDrawingResult } from "./useCanvasDrawing";
import type { GlazeDrawingResult } from "./useGlazeDrawing";

interface CanvasCoordinationOptions {
  canvasData: CanvasData;
  colorLUT: [number, number, number][];
  activeTabId: MainTabId;
  drawing: CanvasDrawingResult;
  glazeDrawing: GlazeDrawingResult;
  srcWrapRef: React.MutableRefObject<HTMLDivElement | null>;
  prvWrapRef: React.MutableRefObject<HTMLDivElement | null>;
  glazeWrapRef: React.MutableRefObject<HTMLDivElement | null>;
  prvRef: React.MutableRefObject<HTMLCanvasElement | null>;
  hexPrvRef: React.MutableRefObject<HTMLCanvasElement | null>;
  glazePrvRef: React.MutableRefObject<HTMLCanvasElement | null>;
  sharedSchedCursorRef: React.MutableRefObject<(() => void) | null>;
  onWheel: (e: WheelEvent) => void;
}

export function useCanvasCoordination(opts: CanvasCoordinationOptions): void {
  const {
    canvasData,
    colorLUT,
    activeTabId,
    drawing,
    glazeDrawing,
    srcWrapRef,
    prvWrapRef,
    glazeWrapRef,
    prvRef,
    hexPrvRef,
    glazePrvRef,
    sharedSchedCursorRef,
    onWheel,
  } = opts;
  const { clearCursor, clearCursorPrv } = drawing;
  const { clearCursor: clearGlazeCursor } = glazeDrawing;

  // Bridge cursor schedulers into the shared ref used by pan/zoom.
  useLayoutEffect(() => {
    sharedSchedCursorRef.current = () => {
      drawing.schedCursorRef.current?.();
      glazeDrawing.schedCursorRef.current?.();
    };
  }, [drawing.schedCursorRef, glazeDrawing.schedCursorRef, sharedSchedCursorRef]);

  // Cleanup RAF on unmount
  useEffect(
    () => () => {
      if (drawing.cursorRafRef.current) cancelAnimationFrame(drawing.cursorRafRef.current);
      if (glazeDrawing.cursorRafRef.current) cancelAnimationFrame(glazeDrawing.cursorRafRef.current);
    },
    [drawing.cursorRafRef, glazeDrawing.cursorRafRef],
  );

  // Wheel listener (non-passive)
  useEffect(() => {
    const s = srcWrapRef.current,
      p = prvWrapRef.current,
      g = glazeWrapRef.current;
    const wheelOpts: AddEventListenerOptions = { passive: false };
    if (s) s.addEventListener("wheel", onWheel, wheelOpts);
    if (p) p.addEventListener("wheel", onWheel, wheelOpts);
    if (g) g.addEventListener("wheel", onWheel, wheelOpts);
    return () => {
      if (s) s.removeEventListener("wheel", onWheel, wheelOpts);
      if (p) p.removeEventListener("wheel", onWheel, wheelOpts);
      if (g) g.removeEventListener("wheel", onWheel, wheelOpts);
    };
  }, [onWheel, srcWrapRef, prvWrapRef, glazeWrapRef, activeTabId]);

  useEffect(() => {
    function isPointInElement(e: MouseEvent | PointerEvent, el: HTMLElement | null) {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      return e.clientX >= r.left && e.clientX < r.left + r.width && e.clientY >= r.top && e.clientY < r.top + r.height;
    }

    function clearCursorsOutsideWorkspace(e: MouseEvent | PointerEvent) {
      if (srcWrapRef.current && !isPointInElement(e, srcWrapRef.current)) clearCursor();
      if (prvWrapRef.current && !isPointInElement(e, prvWrapRef.current)) clearCursorPrv();
      if (glazeWrapRef.current && !isPointInElement(e, glazeWrapRef.current)) clearGlazeCursor();
    }

    document.addEventListener("pointermove", clearCursorsOutsideWorkspace);
    document.addEventListener("mousemove", clearCursorsOutsideWorkspace);
    return () => {
      document.removeEventListener("pointermove", clearCursorsOutsideWorkspace);
      document.removeEventListener("mousemove", clearCursorsOutsideWorkspace);
    };
  }, [clearCursor, clearCursorPrv, clearGlazeCursor, srcWrapRef, prvWrapRef, glazeWrapRef]);

  const renderGlazeCanvas = useCallback(() => {
    const gp = glazePrvRef.current;
    if (!gp) return;
    if (gp.width !== canvasData.width || gp.height !== canvasData.height) {
      gp.width = canvasData.width;
      gp.height = canvasData.height;
      glazeDrawing.imgCacheRef.current = { sourceImageData: null, previewImageData: null, sourcePixels32: null, previewPixels32: null };
    }
    renderCanvasBuffers(
      canvasData.levelData,
      canvasData.width,
      canvasData.height,
      colorLUT,
      null,
      gp,
      glazeDrawing.imgCacheRef.current,
      undefined,
      canvasData.pixelCandidateOverrideMap,
    );
  }, [canvasData, colorLUT, glazePrvRef, glazeDrawing.imgCacheRef]);

  // Render buffer on state change
  useLayoutEffect(() => {
    if (drawing.drawingRef.current || glazeDrawing.drawingRef.current) return;
    const s = drawing.srcRef.current,
      p = prvRef.current,
      hp = hexPrvRef.current;
    if (!s && !p && !hp) return;
    let needReset = false;
    if (s && (s.width !== canvasData.width || s.height !== canvasData.height)) {
      s.width = canvasData.width;
      s.height = canvasData.height;
      needReset = true;
    }
    if (p && (p.width !== canvasData.width || p.height !== canvasData.height)) {
      p.width = canvasData.width;
      p.height = canvasData.height;
      needReset = true;
    }
    if (hp && (hp.width !== canvasData.width || hp.height !== canvasData.height)) {
      hp.width = canvasData.width;
      hp.height = canvasData.height;
    }
    if (needReset)
      drawing.imgCacheRef.current = { sourceImageData: null, previewImageData: null, sourcePixels32: null, previewPixels32: null };
    const previewCanvas = p || hp;
    renderCanvasBuffers(canvasData.levelData, canvasData.width, canvasData.height, colorLUT, s, previewCanvas, drawing.imgCacheRef.current);
    if (hp && p) {
      const hctx = hp.getContext("2d");
      if (hctx && drawing.imgCacheRef.current.previewImageData) {
        hctx.putImageData(drawing.imgCacheRef.current.previewImageData, 0, 0);
      }
    }
    // Also render glaze tab canvas (may be null if tab not mounted yet)
    renderGlazeCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable, renderGlazeCanvas captured via closure
  }, [canvasData, colorLUT, activeTabId]);

  // Glaze tab effect
  useEffect(() => {
    if (activeTabId === "glaze") renderGlazeCanvas();
  }, [activeTabId, renderGlazeCanvas]);
}
