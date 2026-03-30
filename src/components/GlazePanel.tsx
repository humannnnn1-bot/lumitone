import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { LEVEL_INFO, LEVEL_CANDIDATES, findClosestCandidate } from "../color-engine";
import { LinkedViz } from "./LinkedViz";
import { BRUSH_MIN, BRUSH_MAX, BRUSH_STEP, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "../constants";
import type { GlazeToolId } from "../constants";
import { S_BTN, S_BTN_ACTIVE, S_CHECKERBOARD } from "../styles";
import type { PanZoomHandlers, CanvasAction, CanvasData } from "../types";
import type { GlazeDrawingResult } from "../hooks/useGlazeDrawing";
import { useTranslation } from "../i18n";
import { useGlazeContext } from "../contexts/GlazeContext";
import { C, Z, SP, FS, R, SHADOW, HUE_GRADIENT } from "../tokens";

interface GlazePanelProps {
  prvRef: React.RefObject<HTMLCanvasElement | null>;
  prvWrapRef: React.RefObject<HTMLDivElement | null>;
  displayW: number;
  displayH: number;
  canvasTransform: React.CSSProperties;
  canvasCursor: string;
  cvs: CanvasData;
  dispatch: React.Dispatch<CanvasAction>;
  panZoom: PanZoomHandlers;
  glazeDrawing: GlazeDrawingResult;
  announce: (msg: string) => void;
  showToast: (message: string, type: "error" | "success" | "info") => void;
  undo: () => void;
  redo: () => void;
  zoom: number;
  brushLevel: number;
  panZoomMode: boolean;
  setPanZoomMode: React.Dispatch<React.SetStateAction<boolean>>;
  onPinchDown: (e: React.PointerEvent) => void;
  onPinchMove: (e: React.PointerEvent) => void;
  onPinchUp: (e: React.PointerEvent) => void;
}

const S_HUE_WRAP: React.CSSProperties = { position: "relative", width: "100%", paddingTop: SP.xl };
const S_HUE_TRACK: React.CSSProperties = {
  width: "100%",
  height: 16,
  borderRadius: R.lg,
  background: HUE_GRADIENT,
  cursor: "pointer",
  border: `1px solid ${C.border}`,
};
const S_HUE_INPUT: React.CSSProperties = {
  position: "absolute",
  top: 8,
  left: 0,
  width: "100%",
  height: 16,
  opacity: 0,
  cursor: "pointer",
};

const GLAZE_TOOLS: { id: GlazeToolId; labelKey: string; key: string }[] = [
  { id: "glaze_brush", labelKey: "tool_glaze_brush", key: "b" },
  { id: "glaze_eraser", labelKey: "tool_glaze_eraser", key: "e" },
  { id: "glaze_fill", labelKey: "tool_glaze_fill", key: "f" },
];

export const GlazePanel = React.memo(function GlazePanel(props: GlazePanelProps) {
  const {
    prvRef,
    prvWrapRef,
    displayW,
    displayH,
    canvasTransform,
    canvasCursor,
    cvs,
    dispatch,
    panZoom,
    glazeDrawing,
    announce,
    undo,
    redo,
    zoom,
    brushLevel,
    panZoomMode,
    setPanZoomMode,
    onPinchDown,
    onPinchMove,
    onPinchUp,
  } = props;
  const { statusRef: glazeStatusRef, curRef: glazeCurRef } = glazeDrawing;
  const { hueAngle, setHueAngle, glazeTool, setGlazeTool, brushSize, setBrushSize, directCandidates, setDirectCandidates } =
    useGlazeContext();
  const { t } = useTranslation();
  const [showHighlight, setShowHighlight] = useState(false);
  const [hoveredCandidate, setHoveredCandidate] = useState<{ lv: number; ci: number } | null>(null);

  // Keyboard shortcuts for zoom/pan + tool switching
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // Tool shortcuts
      if (k === "b") {
        e.preventDefault();
        setGlazeTool("glaze_brush");
        announce(t("announce_glaze_brush"));
        return;
      }
      if (k === "e") {
        e.preventDefault();
        setGlazeTool("glaze_eraser");
        announce(t("announce_glaze_eraser"));
        return;
      }
      if (k === "f") {
        e.preventDefault();
        setGlazeTool("glaze_fill");
        announce(t("announce_glaze_fill"));
        return;
      }
      // Brush size
      if (e.key === "[") {
        e.preventDefault();
        setBrushSize((s) => Math.max(BRUSH_MIN, s - BRUSH_STEP));
        return;
      }
      if (e.key === "]") {
        e.preventDefault();
        setBrushSize((s) => Math.min(BRUSH_MAX, s + BRUSH_STEP));
        return;
      }
      // Zoom/Pan
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        panZoom.setZoom((z) => Math.min(ZOOM_MAX, z * ZOOM_STEP));
        panZoom.schedCursorRef.current?.();
      } else if (e.key === "-") {
        e.preventDefault();
        panZoom.setZoom((z) => Math.max(ZOOM_MIN, z / ZOOM_STEP));
        panZoom.schedCursorRef.current?.();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        panZoom.setPan((p) => ({ ...p, x: p.x + 10 }));
        panZoom.schedCursorRef.current?.();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        panZoom.setPan((p) => ({ ...p, x: p.x - 10 }));
        panZoom.schedCursorRef.current?.();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        panZoom.setPan((p) => ({ ...p, y: p.y + 10 }));
        panZoom.schedCursorRef.current?.();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        panZoom.setPan((p) => ({ ...p, y: p.y - 10 }));
        panZoom.schedCursorRef.current?.();
      } else if (e.key === "0") {
        e.preventDefault();
        panZoom.setZoom(1);
        panZoom.setPan({ x: 0, y: 0 });
        panZoom.schedCursorRef.current?.();
      }
    },
    [panZoom, setGlazeTool, announce, t, setBrushSize],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (panZoomMode) {
        onPinchDown(e);
        return;
      }
      if (e.button === 1 || panZoom.spaceRef.current) {
        e.preventDefault();
        panZoom.startPan(e);
        return;
      }
      // Right-click or Alt+click: eyedropper (pick hue from pixel)
      if (e.button === 2 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        glazeDrawing.pickHue(e);
        return;
      }
      glazeDrawing.onDown(e);
    },
    [panZoom, glazeDrawing, panZoomMode, onPinchDown],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (panZoomMode) {
        onPinchMove(e);
        return;
      }
      if (panZoom.panningRef.current) {
        panZoom.movePan(e);
        return;
      }
      glazeDrawing.onMove(e);
    },
    [panZoom, glazeDrawing, panZoomMode, onPinchMove],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (panZoomMode) {
        onPinchUp(e);
        return;
      }
      if (panZoom.panningRef.current) {
        panZoom.endPan();
        return;
      }
      glazeDrawing.onUp();
    },
    [panZoom, glazeDrawing, panZoomMode, onPinchUp],
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (panZoomMode) {
        onPinchUp(e);
        return;
      }
      glazeDrawing.onUp();
      glazeDrawing.clearCursor();
    },
    [glazeDrawing, panZoomMode, onPinchUp],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => e.preventDefault(), []);

  const handleHueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setHueAngle(Number(e.target.value));
      setDirectCandidates(new Map()); // exit direct mode when hue slider is used
    },
    [setHueAngle, setDirectCandidates],
  );

  const handleGlazeClear = useCallback(() => {
    dispatch({ type: "glaze_clear" });
  }, [dispatch]);

  const handleZoomReset = useCallback(() => {
    panZoom.setZoom(1);
    panZoom.setPan({ x: 0, y: 0 });
    panZoom.schedCursorRef.current?.();
  }, [panZoom]);

  // Preview: for selected hue angle, show what color each level maps to
  const levelPreview = useMemo(() => {
    return LEVEL_INFO.map((info, lv) => {
      const candidates = LEVEL_CANDIDATES[lv];
      const ci = findClosestCandidate(lv, hueAngle);
      const rgb = candidates[ci]?.rgb ?? [128, 128, 128];
      return { lv, name: info.name, rgb, hex: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` };
    });
  }, [hueAngle]);

  // Count glazed pixels
  const glazeCount = useMemo(() => {
    let c = 0;
    for (let i = 0; i < cvs.colorMap.length; i++) if (cvs.colorMap[i] > 0) c++;
    return c;
  }, [cvs.colorMap]);

  // Hue marker position — 360° wraps to 0° (same hue)
  const hueMarkerLeft = `${((hueAngle % 360) / 360) * 100}%`;

  // Highlight overlay: debounced generation to avoid jank during rapid strokes
  const [highlightUrl, setHighlightUrl] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevHighlightUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!showHighlight) {
      if (prevHighlightUrlRef.current) {
        URL.revokeObjectURL(prevHighlightUrlRef.current);
        prevHighlightUrlRef.current = null;
      }
      setHighlightUrl(null);
      return;
    }
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      const c = document.createElement("canvas");
      c.width = cvs.w;
      c.height = cvs.h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const img = ctx.createImageData(cvs.w, cvs.h);
      const d = img.data;
      for (let i = 0; i < cvs.colorMap.length; i++) {
        if (cvs.colorMap[i] > 0) {
          d[i * 4] = 255;
          d[i * 4 + 1] = 255;
          d[i * 4 + 2] = 0;
          d[i * 4 + 3] = 80;
        }
      }
      ctx.putImageData(img, 0, 0);
      c.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        if (prevHighlightUrlRef.current) URL.revokeObjectURL(prevHighlightUrlRef.current);
        prevHighlightUrlRef.current = url;
        setHighlightUrl(url);
      });
    }, 150);
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (prevHighlightUrlRef.current) {
        URL.revokeObjectURL(prevHighlightUrlRef.current);
        prevHighlightUrlRef.current = null;
      }
    };
  }, [showHighlight, cvs.colorMap, cvs.w, cvs.h]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg }}>
      <div className="panel-layout">
        <div className="panel-canvas" style={{ "--display-max": displayW + "px" } as React.CSSProperties}>
          <div style={{ fontSize: FS.md, color: C.textDim, textAlign: "center", lineHeight: "14px" }}>{t("label_glaze")}</div>
          <div
            ref={prvWrapRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            style={{
              border: panZoomMode ? `1px solid ${C.accentBright}` : `1px solid ${C.border}`,
              borderRadius: R.lg,
              overflow: "hidden",
              position: "relative",
              width: displayW,
              height: displayH,
              outline: "none",
              ...S_CHECKERBOARD,
            }}
          >
            <canvas
              ref={prvRef}
              role="img"
              aria-label={t("label_glaze")}
              style={{ width: displayW, height: displayH, display: "block", ...canvasTransform, cursor: canvasCursor, touchAction: "none" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              onContextMenu={handleContextMenu}
            />
            {highlightUrl && (
              <img
                src={highlightUrl}
                alt=""
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: displayW,
                  height: displayH,
                  pointerEvents: "none",
                  zIndex: Z.cursorOverlay,
                  ...canvasTransform,
                  imageRendering: "pixelated",
                }}
              />
            )}
            <canvas
              ref={glazeCurRef}
              width={displayW}
              height={displayH}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: displayW,
                height: displayH,
                pointerEvents: "none",
                zIndex: Z.cursorOverlay,
              }}
            />
          </div>
          <div
            ref={glazeStatusRef}
            aria-live="polite"
            aria-atomic="true"
            style={{ fontSize: FS.sm, color: C.textDimmer, fontFamily: "monospace", minHeight: 14, textAlign: "center" }}
          >
            {"\u2014"}
          </div>
        </div>
        <div className="panel-sidebar">
          {/* Tools */}
          <div role="radiogroup" aria-label={t("aria_glaze_tools")} style={{ display: "flex", gap: SP.xs, justifyContent: "center" }}>
            {GLAZE_TOOLS.map((gt) => (
              <button
                key={gt.id}
                role="radio"
                aria-checked={glazeTool === gt.id}
                onClick={() => {
                  setGlazeTool(gt.id);
                  if (panZoomMode) setPanZoomMode(false);
                  announce(t("announce_" + gt.id));
                }}
                style={glazeTool === gt.id ? S_BTN_ACTIVE : S_BTN}
              >
                {t(gt.labelKey)}({gt.key.toUpperCase()})
              </button>
            ))}
          </div>

          {/* Undo/Redo + Zoom */}
          <div style={{ display: "flex", gap: SP.md, alignItems: "center", justifyContent: "center", marginTop: SP.lg }}>
            <button style={S_BTN} onClick={undo} title={t("title_undo")}>
              {t("btn_undo")}
            </button>
            <button style={S_BTN} onClick={redo} title={t("title_redo")}>
              {t("btn_redo")}
            </button>
            <button
              style={S_BTN}
              onClick={handleZoomReset}
              title={t("title_zoom_reset")}
              aria-label={t("aria_zoom_reset", Math.round(zoom * 100))}
            >
              {"\u25CE"}
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={() => setPanZoomMode((prev) => !prev)} style={panZoomMode ? S_BTN_ACTIVE : S_BTN}>
              {t("btn_pan_mode")}
            </button>
          </div>

          {/* Brush size */}
          {glazeTool !== "glaze_fill" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: SP.lg,
                fontSize: 11,
                color: C.textDimmer,
                width: "100%",
                marginTop: SP.md,
                marginBottom: SP.md,
              }}
            >
              <span>{t("label_size")}</span>
              <button
                style={S_BTN}
                onClick={() => setBrushSize((s) => Math.max(BRUSH_MIN, s - BRUSH_STEP))}
                aria-label={t("aria_brush_size_decrease")}
              >
                {"\u2212"}
              </button>
              <input
                type="range"
                min={BRUSH_MIN}
                max={BRUSH_MAX}
                step={BRUSH_STEP}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                aria-label={t("aria_brush_size")}
                style={{ flex: 1, minWidth: 60 }}
              />
              <button
                style={S_BTN}
                onClick={() => setBrushSize((s) => Math.min(BRUSH_MAX, s + BRUSH_STEP))}
                aria-label={t("aria_brush_size_increase")}
              >
                +
              </button>
              <span style={{ color: C.textSecondary, minWidth: 20 }}>{brushSize}</span>
            </div>
          )}

          {/* Options + Clear */}
          <div style={{ display: "flex", alignItems: "center", gap: SP.lg, flexWrap: "wrap", justifyContent: "center" }}>
            <label style={{ fontSize: FS.sm, color: C.textDim, cursor: "pointer", display: "flex", alignItems: "center", gap: SP.sm }}>
              <input type="checkbox" checked={showHighlight} onChange={(e) => setShowHighlight(e.target.checked)} />
              {t("glaze_show_highlight")}
            </label>
            <button style={S_BTN} onClick={handleGlazeClear} title={t("title_glaze_clear")}>
              {t("btn_glaze_clear")}
            </button>
            {glazeCount > 0 && <span style={{ fontSize: FS.xs, color: C.textDimmer }}>{glazeCount.toLocaleString()}px</span>}
          </div>

          {/* Hue angle slider with marker */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: SP.md }}>
            <div style={{ fontSize: FS.lg, color: C.textPrimary, textAlign: "center", fontFamily: "monospace" }}>
              {t("glaze_hue_angle")}: {Math.round(hueAngle % 360)}°
            </div>
            <div style={S_HUE_WRAP}>
              <div style={S_HUE_TRACK} />
              {/* Marker triangle */}
              <div
                style={{
                  position: "absolute",
                  top: 1,
                  left: hueMarkerLeft,
                  transform: "translateX(-5px)",
                  width: 0,
                  height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: `6px solid ${C.textPrimary}`,
                  pointerEvents: "none",
                }}
              />
              {/* Candidate switch-point tick marks */}
              {useMemo(() => {
                const ticks: { deg: number; color: string }[] = [];
                for (let lv = 2; lv <= 5; lv++) {
                  const cands = LEVEL_CANDIDATES[lv];
                  if (cands.length <= 1 || cands[0].angle < 0) continue;
                  const angles = cands.map((c) => c.angle).sort((a, b) => a - b);
                  for (let i = 0; i < angles.length; i++) {
                    const a1 = angles[i];
                    const a2 = angles[(i + 1) % angles.length];
                    const diff = (a2 - a1 + 360) % 360;
                    const mid = (a1 + diff / 2) % 360;
                    ticks.push({ deg: mid, color: `rgb(${cands[0].rgb.join(",")})` });
                  }
                }
                return ticks;
              }, []).map((tick, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: 26,
                    left: `${(tick.deg / 359) * 100}%`,
                    transform: "translateX(-0.5px)",
                    width: 1,
                    height: 5,
                    background: C.textDimmer,
                    pointerEvents: "none",
                  }}
                />
              ))}
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={Math.round(hueAngle) % 360}
                onChange={handleHueChange}
                aria-label={t("aria_hue_slider")}
                style={S_HUE_INPUT}
              />
            </div>
          </div>

          {/* Level preview — 2D candidate grid */}
          <div style={{ fontSize: FS.sm, color: C.textDim, textAlign: "center" }}>{t("glaze_preview")}</div>
          <div style={{ display: "flex", gap: SP.sm, justifyContent: "center", alignItems: "center" }}>
            {levelPreview.map((lp) => {
              const cands = LEVEL_CANDIDATES[lp.lv];
              const hasCands = cands.length > 1;
              const isDirect = directCandidates.has(lp.lv);
              const directIdx = directCandidates.get(lp.lv);
              const autoIdx = hasCands ? findClosestCandidate(lp.lv, hueAngle) : 0;
              // Current selected candidate index
              const currentIdx = isDirect ? directIdx! : autoIdx;
              // For 3 candidates: show prev above, current center, next below
              const prevIdx = hasCands ? (currentIdx - 1 + cands.length) % cands.length : -1;
              const nextIdx = hasCands ? (currentIdx + 1) % cands.length : -1;

              const makeSwatch = (ci: number, size: number, _isCurrent: boolean) => {
                const cand = cands[ci];
                const isSelected = directCandidates.get(lp.lv) === ci;
                const isSwatchHovered = hoveredCandidate !== null && hoveredCandidate.lv === lp.lv && hoveredCandidate.ci === ci;
                const isDimmed = hoveredCandidate !== null && !isSwatchHovered;
                return (
                  <div
                    key={ci}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const deselecting = directCandidates.get(lp.lv) === ci;
                      setDirectCandidates((prev) => {
                        const next = new Map(prev);
                        if (deselecting) next.delete(lp.lv);
                        else next.set(lp.lv, ci);
                        return next;
                      });
                      setHoveredCandidate({ lv: lp.lv, ci: deselecting ? autoIdx : ci });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        const deselecting = directCandidates.get(lp.lv) === ci;
                        setDirectCandidates((prev) => {
                          const next = new Map(prev);
                          if (deselecting) next.delete(lp.lv);
                          else next.set(lp.lv, ci);
                          return next;
                        });
                        setHoveredCandidate({ lv: lp.lv, ci: deselecting ? autoIdx : ci });
                      }
                    }}
                    onPointerEnter={() => setHoveredCandidate({ lv: lp.lv, ci })}
                    onPointerLeave={() => setHoveredCandidate(null)}
                    title={`#${cand.rgb.map((c) => c.toString(16).padStart(2, "0")).join("")} ${Math.round(cand.angle)}°`}
                    style={{
                      width: size,
                      height: size,
                      borderRadius: R.md,
                      cursor: "pointer",
                      background: `rgb(${cand.rgb.join(",")})`,
                      border: `2px solid ${isSwatchHovered || isSelected ? C.accent : C.border}`,
                      boxSizing: "border-box" as const,
                      boxShadow: isSwatchHovered || isSelected ? SHADOW.glow(C.accent) : "none",
                      opacity: isDimmed ? 0.35 : 1,
                      transition: "opacity 0.15s, box-shadow 0.15s, border-color 0.15s",
                    }}
                  />
                );
              };

              const cycleCand = (dir: number) => {
                const cur = directCandidates.has(lp.lv) ? directCandidates.get(lp.lv)! : autoIdx;
                const newIdx = (((cur + dir) % cands.length) + cands.length) % cands.length;
                setDirectCandidates((prev) => {
                  const next = new Map(prev);
                  next.set(lp.lv, newIdx);
                  return next;
                });
                setHoveredCandidate({ lv: lp.lv, ci: newIdx });
              };

              const handleWheel = hasCands
                ? (e: React.WheelEvent) => {
                    e.preventDefault();
                    cycleCand(e.deltaY > 0 ? 1 : -1);
                  }
                : undefined;

              // Touch swipe support for cycling candidates
              const swipeStartRef = { current: 0 };
              const handleTouchStart = hasCands
                ? (e: React.TouchEvent) => {
                    swipeStartRef.current = e.touches[0].clientY;
                  }
                : undefined;
              const handleTouchEnd = hasCands
                ? (e: React.TouchEvent) => {
                    const dy = e.changedTouches[0].clientY - swipeStartRef.current;
                    if (Math.abs(dy) > 20) cycleCand(dy > 0 ? 1 : -1);
                  }
                : undefined;

              return (
                <div
                  key={lp.lv}
                  onWheel={handleWheel}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    cursor: hasCands ? "pointer" : "default",
                    touchAction: hasCands ? "none" : "auto",
                  }}
                >
                  {/* Upper candidate */}
                  {hasCands ? makeSwatch(prevIdx, 20, false) : <div style={{ height: 20 }} />}
                  {/* Current / main swatch — click to reset to auto */}
                  {(() => {
                    const mainCi = currentIdx;
                    const isMainHovered = hoveredCandidate !== null && hoveredCandidate.lv === lp.lv && hoveredCandidate.ci === mainCi;
                    const isMainDimmed = hoveredCandidate !== null && !isMainHovered;
                    return (
                      <div
                        role={isDirect ? "button" : undefined}
                        tabIndex={isDirect ? 0 : undefined}
                        onClick={
                          isDirect
                            ? () => {
                                setDirectCandidates((prev) => {
                                  const next = new Map(prev);
                                  next.delete(lp.lv);
                                  return next;
                                });
                              }
                            : undefined
                        }
                        onKeyDown={
                          isDirect
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setDirectCandidates((prev) => {
                                    const next = new Map(prev);
                                    next.delete(lp.lv);
                                    return next;
                                  });
                                }
                              }
                            : undefined
                        }
                        onPointerEnter={() => setHoveredCandidate({ lv: lp.lv, ci: mainCi })}
                        onPointerLeave={() => setHoveredCandidate(null)}
                        title={isDirect ? t("title_reset_auto") : undefined}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: R.md,
                          background: isDirect ? `rgb(${cands[directIdx!]?.rgb.join(",")})` : lp.hex,
                          border: `2px solid ${isMainHovered || isDirect ? C.accent : C.border}`,
                          boxSizing: "border-box" as const,
                          cursor: isDirect ? "pointer" : "default",
                          boxShadow: isMainHovered ? SHADOW.glow(C.accent) : "none",
                          opacity: isMainDimmed ? 0.35 : 1,
                          transition: "opacity 0.15s, box-shadow 0.15s, border-color 0.15s",
                        }}
                      />
                    );
                  })()}
                  {/* Lower candidate */}
                  {hasCands ? makeSwatch(nextIdx, 20, false) : <div style={{ height: 20 }} />}
                </div>
              );
            })}
          </div>

          {/* ── Linked 4-View Visualization ── */}
          <LinkedViz
            hueAngle={hueAngle}
            brushLevel={brushLevel}
            onHueAngleChange={setHueAngle}
            hoveredCandidate={hoveredCandidate}
            onHoverCandidate={setHoveredCandidate}
            directCandidates={directCandidates}
          />
        </div>
        {/* panel-sidebar */}
      </div>
      {/* panel-layout */}
    </div>
  );
});
