import { useState, useCallback, useRef } from "react";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "../constants";
import { useSyncRef } from "./useSyncRef";
import type { CanvasData } from "../types";

export interface PanZoomResult {
  zoom: number;
  pan: { x: number; y: number };
  cursorMode: null | "grab" | "grabbing";
  panZoomMode: boolean;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPan: (v: React.SetStateAction<{ x: number; y: number }>) => void;
  setCursorMode: React.Dispatch<React.SetStateAction<null | "grab" | "grabbing">>;
  setPanZoomMode: React.Dispatch<React.SetStateAction<boolean>>;
  startPan: (e: React.PointerEvent) => void;
  handleMiddleDown: (e: React.PointerEvent) => void;
  movePan: (e: React.PointerEvent) => void;
  endPan: () => void;
  onWheel: (e: WheelEvent) => void;
  onPinchDown: (e: React.PointerEvent) => void;
  onPinchMove: (e: React.PointerEvent) => void;
  onPinchUp: (e: React.PointerEvent) => void;
  panningRef: React.MutableRefObject<boolean>;
  spaceRef: React.MutableRefObject<boolean>;
  panStartRef: React.MutableRefObject<{ x: number; y: number }>;
  panOriginRef: React.MutableRefObject<{ x: number; y: number }>;
  zoomRef: React.MutableRefObject<number>;
  panRef: React.MutableRefObject<{ x: number; y: number }>;
}

export function usePanZoom(cvs: CanvasData, displayW: number, schedCursorRef: React.MutableRefObject<(() => void) | null>): PanZoomResult {
  const [zoom, setZoom] = useState(1);
  // Wrap useState setPan with equality check to skip re-renders when values haven't changed
  const [pan, _setPanRaw] = useState({ x: 0, y: 0 });
  const setPan = useCallback((v: React.SetStateAction<{ x: number; y: number }>) => {
    _setPanRaw((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      return next.x === prev.x && next.y === prev.y ? prev : next;
    });
  }, []);
  const [cursorMode, setCursorMode] = useState<null | "grab" | "grabbing">(null);
  const [panZoomMode, setPanZoomMode] = useState(false);

  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });
  const spaceRef = useRef(false);
  const lastMiddleDownRef = useRef(0);

  const zoomRef = useSyncRef(zoom);
  const panRef = useSyncRef(pan);
  const cvsRef = useSyncRef(cvs);

  // Pinch-to-zoom state
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartDistRef = useRef(0);
  const pinchStartZoomRef = useRef(1);
  const pinchStartPanRef = useRef({ x: 0, y: 0 });

  /** Clamp pan so canvas never drifts fully off-screen (max ±w or ±h). */
  const clampPan = useCallback(
    (p: { x: number; y: number }, cv: { w: number; h: number }) => ({
      x: Math.max(-cv.w, Math.min(cv.w, p.x)),
      y: Math.max(-cv.h, Math.min(cv.h, p.y)),
    }),
    [],
  );

  const endPan = useCallback(() => {
    panningRef.current = false;
    setCursorMode(spaceRef.current ? "grab" : null);
    schedCursorRef.current?.();
  }, [schedCursorRef]);

  const startPan = useCallback(
    (e: React.PointerEvent) => {
      panningRef.current = true;
      setCursorMode("grabbing");
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOriginRef.current = { ...panRef.current };
      if ((e.target as HTMLElement).setPointerCapture)
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch {}
    },
    [panRef],
  );

  /** Middle-click handler: double-click resets zoom/pan, single starts pan. */
  const handleMiddleDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const now = performance.now();
      if (now - lastMiddleDownRef.current < 400) {
        lastMiddleDownRef.current = 0;
        setZoom(1);
        setPan({ x: 0, y: 0 });
        schedCursorRef.current?.();
        return;
      }
      lastMiddleDownRef.current = now;
      startPan(e);
    },
    [startPan, setZoom, setPan, schedCursorRef],
  );

  const movePan = useCallback(
    (e: React.PointerEvent) => {
      if (!panningRef.current) return;
      const dx = e.clientX - panStartRef.current.x,
        dy = e.clientY - panStartRef.current.y;
      const cv = cvsRef.current;
      const scale = (displayW * zoomRef.current) / cv.w;
      const raw = { x: panOriginRef.current.x + dx / scale, y: panOriginRef.current.y + dy / scale };
      setPan(clampPan(raw, cv));
      schedCursorRef.current?.();
    },
    [cvsRef, displayW, zoomRef, schedCursorRef, clampPan, setPan],
  );

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const curZoom = zoomRef.current,
        curPan = panRef.current,
        cv = cvsRef.current;
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, curZoom * factor));
      if (newZoom === curZoom) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mx2 = (e.clientX - rect.left) / rect.width,
        my2 = (e.clientY - rect.top) / rect.height;
      const cx0 = (mx2 - 0.5) / curZoom + 0.5 - curPan.x / cv.w;
      const cy0 = (my2 - 0.5) / curZoom + 0.5 - curPan.y / cv.h;
      const newPanX = ((mx2 - 0.5) / newZoom + 0.5 - cx0) * cv.w;
      const newPanY = ((my2 - 0.5) / newZoom + 0.5 - cy0) * cv.h;
      setZoom(newZoom);
      setPan(clampPan({ x: newPanX, y: newPanY }, cv));
      schedCursorRef.current?.();
    },
    [zoomRef, panRef, cvsRef, schedCursorRef, clampPan, setPan],
  );

  // ── Pinch-to-zoom handlers ──

  const getPinchDist = (ptrs: Map<number, { x: number; y: number }>) => {
    const pts = [...ptrs.values()];
    if (pts.length < 2) return 0;
    const dx = pts[0].x - pts[1].x,
      dy = pts[0].y - pts[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onPinchDown = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if ((e.target as HTMLElement).setPointerCapture) {
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch {}
      }
      if (pointersRef.current.size === 1) {
        // Single finger — start pan
        panningRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        panOriginRef.current = { ...panRef.current };
      } else if (pointersRef.current.size === 2) {
        // Two fingers — start pinch, cancel pan
        panningRef.current = false;
        pinchStartDistRef.current = getPinchDist(pointersRef.current);
        pinchStartZoomRef.current = zoomRef.current;
        pinchStartPanRef.current = { ...panRef.current };
      }
    },
    [panRef, zoomRef],
  );

  const onPinchMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size >= 2 && pinchStartDistRef.current > 0) {
        // Pinch zoom
        const newDist = getPinchDist(pointersRef.current);
        const ratio = newDist / pinchStartDistRef.current;
        const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinchStartZoomRef.current * ratio));
        const cv = cvsRef.current;
        // Adjust pan to keep pinch center stable
        const zRatio = newZoom / pinchStartZoomRef.current;
        const rawPan = {
          x: pinchStartPanRef.current.x * zRatio,
          y: pinchStartPanRef.current.y * zRatio,
        };
        setZoom(newZoom);
        setPan(clampPan(rawPan, cv));
      } else if (pointersRef.current.size === 1 && panningRef.current) {
        // Single finger pan
        const dx = e.clientX - panStartRef.current.x,
          dy = e.clientY - panStartRef.current.y;
        const cv = cvsRef.current;
        const scale = (displayW * zoomRef.current) / cv.w;
        const raw = { x: panOriginRef.current.x + dx / scale, y: panOriginRef.current.y + dy / scale };
        setPan(clampPan(raw, cv));
      }
    },
    [cvsRef, displayW, zoomRef, clampPan, setPan],
  );

  const onPinchUp = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size === 0) {
        panningRef.current = false;
        pinchStartDistRef.current = 0;
      } else if (pointersRef.current.size === 1) {
        // Went from 2 fingers to 1 — don't start drawing, just reset pan start
        pinchStartDistRef.current = 0;
        const remaining = [...pointersRef.current.values()][0];
        panningRef.current = true;
        panStartRef.current = { x: remaining.x, y: remaining.y };
        panOriginRef.current = { ...panRef.current };
      }
    },
    [panRef],
  );

  return {
    zoom,
    pan,
    cursorMode,
    panZoomMode,
    setZoom,
    setPan,
    setCursorMode,
    setPanZoomMode,
    startPan,
    handleMiddleDown,
    movePan,
    endPan,
    onWheel,
    onPinchDown,
    onPinchMove,
    onPinchUp,
    panningRef,
    spaceRef,
    panStartRef,
    panOriginRef,
    zoomRef,
    panRef,
  };
}
