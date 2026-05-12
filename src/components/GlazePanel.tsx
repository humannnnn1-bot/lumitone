import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { LEVEL_INFO, LEVEL_CANDIDATES, findClosestCandidate } from "../color-engine";
import { LinkedVisualization } from "./LinkedVisualization";
import { GlazeCandidateGrid, type GlazeLevelPreview } from "./GlazeCandidateGrid";
import { BRUSH_MIN, BRUSH_MAX, BRUSH_STEP, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "../constants";
import { buildGlazeHighlightPixels } from "../drawing/glaze-highlight";
import type { GlazeToolId } from "../constants";
import { S_BTN, S_BTN_ACTIVE, S_CANVAS_STATUS_STABLE, S_CHECKERBOARD } from "../styles/shared";
import type { PanZoomHandlers, CanvasAction, CanvasData } from "../types";
import type { GlazeDrawingResult } from "../hooks/useGlazeDrawing";
import { useTranslation } from "../i18n";
import { useGlazeContext } from "../state/GlazeContext";
import { C, Z, SP, FS, R, HUE_GRADIENT } from "../styles/tokens";

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
const S_GLAZE_ACTION_BUTTON_BASE: React.CSSProperties = {
  boxSizing: "border-box",
  height: 22,
  minHeight: 22,
  padding: "0 6px",
  fontSize: FS.lg,
  lineHeight: "20px",
  whiteSpace: "nowrap",
};
const S_GLAZE_ACTION_BUTTON: React.CSSProperties = { ...S_BTN, ...S_GLAZE_ACTION_BUTTON_BASE };
const S_GLAZE_ACTION_BUTTON_ACTIVE: React.CSSProperties = { ...S_BTN_ACTIVE, ...S_GLAZE_ACTION_BUTTON_BASE };

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
  const {
    hueAngle,
    setHueAngle,
    glazeTool,
    setGlazeTool,
    brushSize,
    setBrushSize,
    candidateOverridesByLevel,
    setCandidateOverridesByLevel,
  } = useGlazeContext();
  const { t } = useTranslation();
  const [showHighlight, setShowHighlight] = useState(false);
  const [hoveredCandidate, setHoveredCandidate] = useState<{ levelIndex: number; candidateIndex: number } | null>(null);
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set());

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
      if (e.button === 1) {
        panZoom.handleMiddleDown(e);
        return;
      }
      if (panZoom.spaceRef.current) {
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
      glazeDrawing.onWorkspaceDown(e);
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
      glazeDrawing.onWorkspaceMove(e);
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
      glazeDrawing.onWorkspaceLeave(e);
    },
    [glazeDrawing, panZoomMode, onPinchUp],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => e.preventDefault(), []);

  const handleHueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setHueAngle(Number(e.target.value));
      setCandidateOverridesByLevel(new Map());
      setSelectedLevels(new Set());
    },
    [setHueAngle, setCandidateOverridesByLevel],
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
  const levelPreview = useMemo<GlazeLevelPreview[]>(() => {
    return LEVEL_INFO.map((info, levelIndex) => {
      const candidates = LEVEL_CANDIDATES[levelIndex];
      const candidateIndex = findClosestCandidate(levelIndex, hueAngle);
      const rgb = candidates[candidateIndex]?.rgb ?? [128, 128, 128];
      return { levelIndex, name: info.name, rgb, hex: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` };
    });
  }, [hueAngle]);

  const hueTicks = useMemo(() => {
    const ticks: { deg: number; color: string }[] = [];
    for (let levelIndex = 2; levelIndex <= 5; levelIndex++) {
      const cands = LEVEL_CANDIDATES[levelIndex];
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
  }, []);

  // Count glazed pixels
  const glazeCount = useMemo(() => {
    let c = 0;
    for (let i = 0; i < cvs.colorMap.length; i++) if (cvs.colorMap[i] > 0) c++;
    return c;
  }, [cvs.colorMap]);

  // Hue marker position — 360° wraps to 0° (same hue)
  const hueMarkerLeft = `${((hueAngle % 360) / 360) * 100}%`;

  // Highlight overlay: debounced generation to avoid jank during rapid strokes
  const highlightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    if (!showHighlight || glazeCount === 0) return;
    let cancelled = false;
    highlightTimerRef.current = setTimeout(() => {
      if (cancelled) return;
      const c = highlightCanvasRef.current;
      if (!c) return;
      if (c.width !== cvs.w) c.width = cvs.w;
      if (c.height !== cvs.h) c.height = cvs.h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const img = ctx.createImageData(cvs.w, cvs.h);
      img.data.set(buildGlazeHighlightPixels(cvs.colorMap, cvs.w, cvs.h));
      ctx.putImageData(img, 0, 0);
    }, 75);
    return () => {
      cancelled = true;
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, [showHighlight, glazeCount, cvs.colorMap, cvs.w, cvs.h]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg }}>
      <div className="panel-layout">
        <div className="panel-canvas" style={{ "--display-max": displayW + "px" } as React.CSSProperties}>
          <div style={{ fontSize: FS.md, color: C.textDim, textAlign: "center", lineHeight: "14px" }}>{t("label_glaze")}</div>
          <div
            className="canvas-workspace"
            ref={prvWrapRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onMouseLeave={glazeDrawing.clearCursor}
            onContextMenu={handleContextMenu}
            style={{
              border: panZoomMode ? `1px solid ${C.accentBright}` : `1px solid ${C.border}`,
              borderRadius: R.lg,
              overflow: "hidden",
              position: "relative",
              width: displayW,
              height: displayH,
              outline: "none",
              cursor: panZoomMode ? "grab" : canvasCursor,
              touchAction: "none",
              ...S_CHECKERBOARD,
            }}
          >
            <canvas
              ref={prvRef}
              role="img"
              aria-label={t("label_glaze")}
              style={{
                width: displayW,
                height: displayH,
                display: "block",
                ...canvasTransform,
                cursor: panZoomMode ? "grab" : canvasCursor,
                touchAction: "none",
              }}
            />
            {showHighlight && glazeCount > 0 && (
              <canvas
                ref={highlightCanvasRef}
                width={cvs.w}
                height={cvs.h}
                aria-hidden="true"
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
              className="canvas-cursor-overlay"
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
          <div ref={glazeStatusRef} aria-live="polite" aria-atomic="true" style={S_CANVAS_STATUS_STABLE}>
            {"\u2014"}
          </div>
        </div>
        <div className="panel-sidebar">
          {/* Tools */}
          <div role="radiogroup" aria-label={t("aria_glaze_tools")} style={{ display: "flex", gap: SP.lg, justifyContent: "center" }}>
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
                style={glazeTool === gt.id ? S_GLAZE_ACTION_BUTTON_ACTIVE : S_GLAZE_ACTION_BUTTON}
              >
                {t(gt.labelKey)}({gt.key.toUpperCase()})
              </button>
            ))}
          </div>

          {/* Undo/Redo + Zoom */}
          <div style={{ display: "flex", gap: SP.lg, alignItems: "center", justifyContent: "center", marginTop: SP.lg }}>
            <button style={S_GLAZE_ACTION_BUTTON} onClick={undo} title={t("title_undo")}>
              {t("btn_undo")}
            </button>
            <button style={S_GLAZE_ACTION_BUTTON} onClick={redo} title={t("title_redo")}>
              {t("btn_redo")}
            </button>
            <button
              style={{ ...S_GLAZE_ACTION_BUTTON, marginLeft: SP.lg }}
              onClick={handleZoomReset}
              title={t("title_zoom_reset")}
              aria-label={t("aria_zoom_reset", Math.round(zoom * 100))}
            >
              {"\u25CE"}
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setPanZoomMode((prev) => !prev)}
              style={panZoomMode ? S_GLAZE_ACTION_BUTTON_ACTIVE : S_GLAZE_ACTION_BUTTON}
            >
              {t("btn_pan_mode")}
            </button>
          </div>

          {/* Options + Clear */}
          <div style={{ display: "flex", alignItems: "center", gap: SP.xl, flexWrap: "wrap", justifyContent: "center", marginTop: SP.xl }}>
            <label style={{ fontSize: FS.md, color: C.textDim, cursor: "pointer", display: "flex", alignItems: "center", gap: SP.sm }}>
              <input type="checkbox" checked={showHighlight} onChange={(e) => setShowHighlight(e.target.checked)} />
              {t("glaze_show_highlight")}
            </label>
            <button style={S_GLAZE_ACTION_BUTTON} onClick={handleGlazeClear} title={t("title_glaze_clear")}>
              {t("btn_glaze_clear")}
            </button>
            {glazeCount > 0 && <span style={{ fontSize: FS.xs, color: C.textDimmer }}>{glazeCount.toLocaleString()}px</span>}
          </div>

          {/* Brush size */}
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

          {/* Hue angle slider with marker */}
          <div className="glaze-hue-section" style={{ width: "100%", display: "flex", flexDirection: "column", gap: SP.md }}>
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
              {/* Candidate switch-point tick marks (above the bar) */}
              {hueTicks.map((tick, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: 3,
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

          <GlazeCandidateGrid
            levelPreview={levelPreview}
            hueAngle={hueAngle}
            candidateOverridesByLevel={candidateOverridesByLevel}
            selectedLevels={selectedLevels}
            hoveredCandidate={hoveredCandidate}
            onCandidateOverridesByLevelChange={setCandidateOverridesByLevel}
            onSelectedLevelsChange={setSelectedLevels}
            onHoveredCandidateChange={setHoveredCandidate}
          />

          {/* ── Linked 4-View Visualization ── */}
          <LinkedVisualization
            hueAngle={hueAngle}
            brushLevel={brushLevel}
            onHueAngleChange={setHueAngle}
            hoveredCandidate={hoveredCandidate}
            onHoverCandidate={setHoveredCandidate}
            candidateOverridesByLevel={candidateOverridesByLevel}
          />
        </div>
        {/* panel-sidebar */}
      </div>
      {/* panel-layout */}
    </div>
  );
});
