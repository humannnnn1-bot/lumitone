import { useState, useCallback, useRef } from "react";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "../constants";
import { useSyncRef } from "./useSyncRef";
import type { CanvasData } from "../types";

interface PanZoomResult {
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

type PointerPoint = { x: number; y: number };
type ViewportPoint = { x: number; y: number };

function getPinchDist(ptrs: Map<number, PointerPoint>) {
  const pts = [...ptrs.values()];
  if (pts.length < 2) return 0;
  const dx = pts[0].x - pts[1].x,
    dy = pts[0].y - pts[1].y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getPinchCenter(ptrs: Map<number, PointerPoint>) {
  const pts = [...ptrs.values()];
  if (pts.length < 2) return { x: 0, y: 0 };
  return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
}

function getViewportPoint(point: PointerPoint, target: EventTarget | null): ViewportPoint | null {
  const el = target as HTMLElement | null;
  if (!el || typeof el.getBoundingClientRect !== "function") return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return { x: (point.x - rect.left) / rect.width, y: (point.y - rect.top) / rect.height };
}

function canvasFocusFromViewportPoint(point: ViewportPoint, zoom: number, pan: { x: number; y: number }, cv: { w: number; h: number }) {
  return {
    x: (point.x - 0.5) / zoom + 0.5 - pan.x / cv.w,
    y: (point.y - 0.5) / zoom + 0.5 - pan.y / cv.h,
  };
}

function panForCanvasFocus(point: ViewportPoint, zoom: number, focus: ViewportPoint, cv: { w: number; h: number }) {
  return {
    x: ((point.x - 0.5) / zoom + 0.5 - focus.x) * cv.w,
    y: ((point.y - 0.5) / zoom + 0.5 - focus.y) * cv.h,
  };
}

export function usePanZoom(cvs: CanvasData, displayW: number, schedCursorRef: React.MutableRefObject<(() => void) | null>): PanZoomResult {
  const [zoom, _setZoomRaw] = useState(1);
  const [pan, _setPanRaw] = useState({ x: 0, y: 0 });
  const [cursorMode, setCursorMode] = useState<null | "grab" | "grabbing">(null);
  const [panZoomMode, _setPanZoomModeRaw] = useState(false);

  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });
  const spaceRef = useRef(false);
  const lastMiddleDownRef = useRef(0);

  const zoomRef = useSyncRef(zoom);
  const panRef = useSyncRef(pan);
  const panZoomModeRef = useSyncRef(panZoomMode);
  const cvsRef = useSyncRef(cvs);

  const setZoom = useCallback(
    (v: React.SetStateAction<number>) => {
      const next = typeof v === "function" ? v(zoomRef.current) : v;
      zoomRef.current = next;
      _setZoomRaw(next);
    },
    [zoomRef],
  );

  // Keep panRef ahead of React rendering so same-frame grid redraws follow active pans.
  const setPan = useCallback(
    (v: React.SetStateAction<{ x: number; y: number }>) => {
      const next = typeof v === "function" ? v(panRef.current) : v;
      panRef.current = next;
      _setPanRaw((prev) => (next.x === prev.x && next.y === prev.y ? prev : next));
    },
    [panRef],
  );

  // Pinch-to-zoom state
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartDistRef = useRef(0);
  const pinchStartZoomRef = useRef(1);
  const pinchStartPanRef = useRef({ x: 0, y: 0 });
  const pinchStartCenterRef = useRef({ x: 0, y: 0 });
  const pinchStartFocusRef = useRef({ x: 0.5, y: 0.5 });

  const clearPanInteraction = useCallback(() => {
    panningRef.current = false;
    spaceRef.current = false;
    pointersRef.current.clear();
    pinchStartDistRef.current = 0;
    setCursorMode(null);
    schedCursorRef.current?.();
  }, [schedCursorRef]);

  const setPanZoomMode: React.Dispatch<React.SetStateAction<boolean>> = useCallback(
    (v) => {
      const next = typeof v === "function" ? v(panZoomModeRef.current) : v;
      panZoomModeRef.current = next;
      _setPanZoomModeRaw(next);
      if (!next) clearPanInteraction();
    },
    [clearPanInteraction, panZoomModeRef],
  );

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
      const pointer = getViewportPoint({ x: e.clientX, y: e.clientY }, e.currentTarget);
      if (!pointer) return;
      const focus = canvasFocusFromViewportPoint(pointer, curZoom, curPan, cv);
      setZoom(newZoom);
      setPan(clampPan(panForCanvasFocus(pointer, newZoom, focus, cv), cv));
      schedCursorRef.current?.();
    },
    [zoomRef, panRef, cvsRef, schedCursorRef, clampPan, setZoom, setPan],
  );

  // ── Pinch-to-zoom handlers ──

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
        pinchStartCenterRef.current = getPinchCenter(pointersRef.current);
        const cv = cvsRef.current;
        const startViewportCenter = getViewportPoint(pinchStartCenterRef.current, e.currentTarget);
        pinchStartFocusRef.current = startViewportCenter
          ? canvasFocusFromViewportPoint(startViewportCenter, zoomRef.current, panRef.current, cv)
          : { x: 0.5 - panRef.current.x / cv.w, y: 0.5 - panRef.current.y / cv.h };
      }
    },
    [cvsRef, panRef, zoomRef],
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
        const currentCenter = getPinchCenter(pointersRef.current);
        const centerDx = currentCenter.x - pinchStartCenterRef.current.x;
        const centerDy = currentCenter.y - pinchStartCenterRef.current.y;
        const viewportCenter = getViewportPoint(currentCenter, e.currentTarget);
        const rawPan = viewportCenter
          ? panForCanvasFocus(viewportCenter, newZoom, pinchStartFocusRef.current, cv)
          : {
              // Fallback for synthetic or unusual pointer events without an element rect.
              x: pinchStartPanRef.current.x * (newZoom / pinchStartZoomRef.current) + centerDx / ((displayW * newZoom) / cv.w),
              y: pinchStartPanRef.current.y * (newZoom / pinchStartZoomRef.current) + centerDy / ((displayW * newZoom) / cv.w),
            };
        setZoom(newZoom);
        setPan(clampPan(rawPan, cv));
        schedCursorRef.current?.();
      } else if (pointersRef.current.size === 1 && panningRef.current) {
        // Single finger pan
        const dx = e.clientX - panStartRef.current.x,
          dy = e.clientY - panStartRef.current.y;
        const cv = cvsRef.current;
        const scale = (displayW * zoomRef.current) / cv.w;
        const raw = { x: panOriginRef.current.x + dx / scale, y: panOriginRef.current.y + dy / scale };
        setPan(clampPan(raw, cv));
        schedCursorRef.current?.();
      }
    },
    [cvsRef, displayW, zoomRef, schedCursorRef, clampPan, setZoom, setPan],
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
