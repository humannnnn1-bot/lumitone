import { useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { renderBuf } from "../render-buf";
import type { CanvasData } from "../types";
import type { CanvasDrawingResult } from "./useCanvasDrawing";
import type { GlazeDrawingResult } from "./useGlazeDrawing";

export interface CanvasCoordinationOptions {
  cvs: CanvasData;
  colorLUT: [number, number, number][];
  activeTab: number;
  drawing: CanvasDrawingResult;
  glazeDrawing: GlazeDrawingResult;
  srcWrapRef: React.MutableRefObject<HTMLDivElement | null>;
  prvWrapRef: React.MutableRefObject<HTMLDivElement | null>;
  glazeWrapRef: React.MutableRefObject<HTMLDivElement | null>;
  prvRef: React.MutableRefObject<HTMLCanvasElement | null>;
  hexPrvRef: React.MutableRefObject<HTMLCanvasElement | null>;
  glazePrvRef: React.MutableRefObject<HTMLCanvasElement | null>;
  onWheel: (e: WheelEvent) => void;
}

export interface CanvasCoordinationResult {
  sharedSchedCursorRef: React.MutableRefObject<(() => void) | null>;
}

export function useCanvasCoordination(opts: CanvasCoordinationOptions): CanvasCoordinationResult {
  const { cvs, colorLUT, activeTab, drawing, glazeDrawing, srcWrapRef, prvWrapRef, glazeWrapRef, prvRef, hexPrvRef, glazePrvRef, onWheel } =
    opts;

  const sharedSchedCursorRef = useRef<(() => void) | null>(null);

  // Bridge schedCursorRef from drawing hook to shared ref used by panZoom
  useLayoutEffect(() => {
    sharedSchedCursorRef.current = drawing.schedCursorRef.current;
  });

  // Cleanup RAF on unmount
  useEffect(
    () => () => {
      if (drawing.cursorRafRef.current) cancelAnimationFrame(drawing.cursorRafRef.current);
      if (glazeDrawing.cursorRafRef.current) cancelAnimationFrame(glazeDrawing.cursorRafRef.current);
    },
    [],
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
  }, [onWheel, srcWrapRef, prvWrapRef, glazeWrapRef, activeTab]);

  const renderGlazeCanvas = useCallback(() => {
    const gp = glazePrvRef.current;
    if (!gp) return;
    if (gp.width !== cvs.w || gp.height !== cvs.h) {
      gp.width = cvs.w;
      gp.height = cvs.h;
      glazeDrawing.imgCacheRef.current = { src: null, prv: null, s32: null, p32: null };
    }
    renderBuf(cvs.data, cvs.w, cvs.h, colorLUT, null, gp, glazeDrawing.imgCacheRef.current, undefined, cvs.colorMap);
  }, [cvs, colorLUT, glazePrvRef, glazeDrawing.imgCacheRef]);

  // Render buffer on state change
  useLayoutEffect(() => {
    if (drawing.drawingRef.current || glazeDrawing.drawingRef.current) return;
    const s = drawing.srcRef.current,
      p = prvRef.current,
      hp = hexPrvRef.current;
    if (!s && !p && !hp) return;
    let needReset = false;
    if (s && (s.width !== cvs.w || s.height !== cvs.h)) {
      s.width = cvs.w;
      s.height = cvs.h;
      needReset = true;
    }
    if (p && (p.width !== cvs.w || p.height !== cvs.h)) {
      p.width = cvs.w;
      p.height = cvs.h;
      needReset = true;
    }
    if (needReset) drawing.imgCacheRef.current = { src: null, prv: null, s32: null, p32: null };
    renderBuf(cvs.data, cvs.w, cvs.h, colorLUT, s, p || hp, drawing.imgCacheRef.current);
    if (hp) {
      if (hp.width !== cvs.w || hp.height !== cvs.h) {
        hp.width = cvs.w;
        hp.height = cvs.h;
      }
      const hctx = hp.getContext("2d");
      if (hctx && drawing.imgCacheRef.current.prv) {
        hctx.putImageData(drawing.imgCacheRef.current.prv, 0, 0);
      }
    }
    // Also render glaze tab canvas (may be null if tab not mounted yet)
    renderGlazeCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable, renderGlazeCanvas captured via closure
  }, [cvs, colorLUT, activeTab]);

  // Glaze tab effect
  useEffect(() => {
    if (activeTab === 3) renderGlazeCanvas();
  }, [activeTab, renderGlazeCanvas]);

  return { sharedSchedCursorRef };
}
