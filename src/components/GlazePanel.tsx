import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { LEVEL_INFO, LEVEL_CANDIDATES, findClosestCandidate } from "../color-engine";
import { BRUSH_MIN, BRUSH_MAX, BRUSH_STEP, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "../constants";
import type { GlazeToolId } from "../constants";
import { S_BTN, S_BTN_ACTIVE } from "../styles";
import type { PanZoomHandlers, CanvasAction, CanvasData } from "../types";
import type { GlazeDrawingResult } from "../hooks/useGlazeDrawing";
import { useTranslation } from "../i18n";
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
  hueAngle: number;
  setHueAngle: React.Dispatch<React.SetStateAction<number>>;
  glazeTool: GlazeToolId;
  setGlazeTool: React.Dispatch<React.SetStateAction<GlazeToolId>>;
  brushSize: number;
  setBrushSize: React.Dispatch<React.SetStateAction<number>>;
  announce: (msg: string) => void;
  showToast: (message: string, type: "error" | "success" | "info") => void;
  undo: () => void;
  redo: () => void;
  zoom: number;
  directCandidates: Map<number, number>;
  setDirectCandidates: React.Dispatch<React.SetStateAction<Map<number, number>>>;
}

const S_HUE_WRAP: React.CSSProperties = { position: "relative", width: "100%", paddingTop: SP.xl };
const S_HUE_TRACK: React.CSSProperties = {
  width: "100%", height: 16, borderRadius: R.lg,
  background: HUE_GRADIENT,
  cursor: "pointer", border: `1px solid ${C.border}`,
};
const S_HUE_INPUT: React.CSSProperties = { position: "absolute", top: 8, left: 0, width: "100%", height: 16, opacity: 0, cursor: "pointer" };

const GLAZE_TOOLS: { id: GlazeToolId; labelKey: string; key: string }[] = [
  { id: "glaze_brush", labelKey: "tool_glaze_brush", key: "b" },
  { id: "glaze_eraser", labelKey: "tool_glaze_eraser", key: "e" },
  { id: "glaze_fill", labelKey: "tool_glaze_fill", key: "f" },
];

export const GlazePanel = React.memo(function GlazePanel(props: GlazePanelProps) {
  const {
    prvRef, prvWrapRef, displayW, displayH, canvasTransform, canvasCursor,
    cvs, dispatch, panZoom, glazeDrawing,
    hueAngle, setHueAngle, glazeTool, setGlazeTool,
    brushSize, setBrushSize, announce, showToast,
    undo, redo, zoom,
    directCandidates, setDirectCandidates,
  } = props;
  const { t } = useTranslation();
  const [showHighlight, setShowHighlight] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);

  // Keyboard shortcuts for zoom/pan + tool switching
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    // Tool shortcuts
    if (k === "b") { e.preventDefault(); setGlazeTool("glaze_brush"); announce(t("announce_glaze_brush")); return; }
    if (k === "e") { e.preventDefault(); setGlazeTool("glaze_eraser"); announce(t("announce_glaze_eraser")); return; }
    if (k === "f") { e.preventDefault(); setGlazeTool("glaze_fill"); announce(t("announce_glaze_fill")); return; }
    // Brush size
    if (e.key === "[") { e.preventDefault(); setBrushSize(s => Math.max(BRUSH_MIN, s - BRUSH_STEP)); return; }
    if (e.key === "]") { e.preventDefault(); setBrushSize(s => Math.min(BRUSH_MAX, s + BRUSH_STEP)); return; }
    // Zoom/Pan
    if (e.key === "+" || e.key === "=") { e.preventDefault(); panZoom.setZoom(z => Math.min(ZOOM_MAX, z * ZOOM_STEP)); panZoom.schedCursorRef.current?.(); }
    else if (e.key === "-") { e.preventDefault(); panZoom.setZoom(z => Math.max(ZOOM_MIN, z / ZOOM_STEP)); panZoom.schedCursorRef.current?.(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); panZoom.setPan(p => ({ ...p, x: p.x + 10 })); panZoom.schedCursorRef.current?.(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); panZoom.setPan(p => ({ ...p, x: p.x - 10 })); panZoom.schedCursorRef.current?.(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); panZoom.setPan(p => ({ ...p, y: p.y + 10 })); panZoom.schedCursorRef.current?.(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); panZoom.setPan(p => ({ ...p, y: p.y - 10 })); panZoom.schedCursorRef.current?.(); }
    else if (e.key === "0") { e.preventDefault(); panZoom.setZoom(1); panZoom.setPan({ x: 0, y: 0 }); panZoom.schedCursorRef.current?.(); }
  }, [panZoom, setGlazeTool, announce, t, setBrushSize]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || panZoom.spaceRef.current) { e.preventDefault(); panZoom.startPan(e); return; }
    // Right-click or Alt+click: eyedropper (pick hue from pixel)
    if (e.button === 2 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      glazeDrawing.pickHue(e);
      return;
    }
    glazeDrawing.onDown(e);
  }, [panZoom, glazeDrawing]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (panZoom.panningRef.current) { panZoom.movePan(e); return; }
    glazeDrawing.onMove(e);
  }, [panZoom, glazeDrawing]);

  const handlePointerUp = useCallback(() => {
    if (panZoom.panningRef.current) { panZoom.endPan(); return; }
    glazeDrawing.onUp();
  }, [panZoom, glazeDrawing]);

  const handlePointerLeave = useCallback(() => {
    glazeDrawing.onUp(); glazeDrawing.clearCursor();
  }, [glazeDrawing]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => e.preventDefault(), []);

  const handleHueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHueAngle(Number(e.target.value));
    setDirectCandidates(new Map()); // exit direct mode when hue slider is used
  }, [setHueAngle, setDirectCandidates]);

  const handleGlazeClear = useCallback(() => {
    dispatch({ type: "glaze_clear" });
    showToast(t("toast_glaze_cleared"), "info");
  }, [dispatch, showToast, t]);

  const handleZoomReset = useCallback(() => {
    panZoom.setZoom(1); panZoom.setPan({ x: 0, y: 0 }); panZoom.schedCursorRef.current?.();
  }, [panZoom]);

  // Level swatch keyboard handler (Enter/Space to toggle expand)
  const handleSwatchKeyDown = useCallback((lv: number, e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (LEVEL_CANDIDATES[lv].length > 1) setExpandedLevel(prev => prev === lv ? null : lv);
    }
  }, []);

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

  useEffect(() => {
    if (!showHighlight) { setHighlightUrl(null); return; }
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      const c = document.createElement("canvas");
      c.width = cvs.w; c.height = cvs.h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const img = ctx.createImageData(cvs.w, cvs.h);
      const d = img.data;
      for (let i = 0; i < cvs.colorMap.length; i++) {
        if (cvs.colorMap[i] > 0) {
          d[i * 4] = 255; d[i * 4 + 1] = 255; d[i * 4 + 2] = 0; d[i * 4 + 3] = 80;
        }
      }
      ctx.putImageData(img, 0, 0);
      setHighlightUrl(c.toDataURL());
    }, 150);
    return () => { if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current); };
  }, [showHighlight, cvs.colorMap, cvs.w, cvs.h]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg, maxWidth: displayW + 40 }}>
      <div style={{ fontSize: FS.md, color: C.textDim, minHeight: SP["3xl"] }}>{t("label_glaze")}</div>

      {/* Canvas */}
      <div ref={prvWrapRef} tabIndex={0} onKeyDown={handleKeyDown}
        style={{ border: `1px solid ${C.border}`, borderRadius: R.lg, overflow: "hidden", position: "relative", width: displayW, height: displayH, outline: "none" }}>
        <canvas ref={prvRef}
          role="img" aria-label={t("label_glaze")}
          style={{ width: displayW, height: displayH, display: "block", ...canvasTransform, cursor: canvasCursor, touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onContextMenu={handleContextMenu}
        />
        {highlightUrl && (
          <img src={highlightUrl} alt=""
            style={{ position: "absolute", top: 0, left: 0, width: displayW, height: displayH, pointerEvents: "none", zIndex: Z.cursorOverlay, ...canvasTransform, imageRendering: "pixelated" }} />
        )}
        <canvas ref={glazeDrawing.curRef} width={displayW} height={displayH}
          style={{ position: "absolute", top: 0, left: 0, width: displayW, height: displayH, pointerEvents: "none", zIndex: Z.cursorOverlay }} />
      </div>

      {/* Status */}
      {/* eslint-disable-next-line react-hooks/refs -- passing ref to DOM, not reading .current */}
      <div ref={glazeDrawing.statusRef}
        aria-live="polite" aria-atomic="true"
        style={{ fontSize: FS.sm, color: C.textDimmer, fontFamily: "monospace", minHeight: 14, textAlign: "center" }}>{"\u2014"}</div>

      {/* Undo/Redo + Zoom */}
      <div style={{ display: "flex", gap: SP.md, alignItems: "center" }}>
        <button style={S_BTN} onClick={undo} title={t("title_undo")}>{t("btn_undo")}</button>
        <button style={S_BTN} onClick={redo} title={t("title_redo")}>{t("btn_redo")}</button>
        <button style={S_BTN} onClick={handleZoomReset}
          title={t("title_zoom_reset")} aria-label={t("aria_zoom_reset", Math.round(zoom * 100))}>
          {"\u2299"}{Math.round(zoom * 100)}%
        </button>
      </div>

      {/* Tools */}
      <div role="radiogroup" aria-label={t("aria_glaze_tools")} style={{ display: "flex", gap: SP.xs }}>
        {GLAZE_TOOLS.map(gt => (
          <button key={gt.id} role="radio" aria-checked={glazeTool === gt.id}
            onClick={() => { setGlazeTool(gt.id); announce(t("announce_" + gt.id)); }}
            style={glazeTool === gt.id ? S_BTN_ACTIVE : S_BTN}>
            {t(gt.labelKey)}({gt.key.toUpperCase()})
          </button>
        ))}
      </div>

      {/* Hue angle slider with marker */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: SP.md }}>
        <div style={{ fontSize: FS.lg, color: C.textPrimary, textAlign: "center", fontFamily: "monospace" }}>
          {t("glaze_hue_angle")}: {Math.round(hueAngle % 360)}°
        </div>
        <div style={S_HUE_WRAP}>
          <div style={S_HUE_TRACK} />
          {/* Marker triangle */}
          <div style={{
            position: "absolute", top: 1, left: hueMarkerLeft,
            transform: "translateX(-5px)",
            width: 0, height: 0,
            borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
            borderTop: `6px solid ${C.textPrimary}`,
            pointerEvents: "none",
          }} />
          <input type="range" min={0} max={359} step={1} value={Math.round(hueAngle) % 360}
            onChange={handleHueChange}
            aria-label={t("aria_hue_slider")}
            style={S_HUE_INPUT} />
        </div>
      </div>

      {/* Level preview + candidate picker */}
      <div style={{ fontSize: FS.sm, color: C.textDim, textAlign: "center" }}>{t("glaze_preview")}</div>
      <div style={{ display: "flex", gap: SP.sm, justifyContent: "center" }}>
        {levelPreview.map(lp => {
          const canExpand = LEVEL_CANDIDATES[lp.lv].length > 1;
          const isExpanded = expandedLevel === lp.lv;
          const isDirect = directCandidates.has(lp.lv);
          const directIdx = directCandidates.get(lp.lv);
          const candidateCount = LEVEL_CANDIDATES[lp.lv].length;
          return (
            <div key={lp.lv}
              role={canExpand ? "button" : undefined} tabIndex={canExpand ? 0 : undefined}
              onClick={canExpand ? () => setExpandedLevel(prev => prev === lp.lv ? null : lp.lv) : undefined}
              onKeyDown={canExpand ? (e => handleSwatchKeyDown(lp.lv, e)) : undefined}
              aria-label={t("glaze_level_swatch_aria", lp.lv, lp.name, isDirect ? t("glaze_direct") : t("glaze_unlimited"))}
              title={canExpand ? t("glaze_level_click_hint", lp.lv, lp.name) : undefined}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, cursor: canExpand ? "pointer" : "default" }}>
              <div style={{
                width: 28, height: 28, borderRadius: R.md,
                background: isDirect ? `rgb(${LEVEL_CANDIDATES[lp.lv][directIdx!]?.rgb.join(",")})` : lp.hex,
                border: isDirect ? `2px solid ${C.accent}` : isExpanded ? `2px solid ${C.textPrimary}` : `1px solid ${C.border}`,
              }} />
              <span style={{ fontSize: FS.xs, color: isDirect ? C.accent : C.textDimmer }}>L{lp.lv}</span>
              {/* E: Candidate count badge */}
              <span style={{ fontSize: FS.xxs, color: C.textDimmest }}>{candidateCount > 1 ? `\u00D7${candidateCount}` : ""}</span>
            </div>
          );
        })}
      </div>
      {/* Expanded candidates for selected level */}
      {expandedLevel !== null && LEVEL_CANDIDATES[expandedLevel].length > 1 && (() => {
        const autoIdx = findClosestCandidate(expandedLevel, hueAngle);
        const isDirectMode = directCandidates.size > 0;
        return (
          <div style={{ display: "flex", gap: SP.md, justifyContent: "center", flexWrap: "wrap", padding: `${SP.md}px 0` }}>
            {LEVEL_CANDIDATES[expandedLevel].map((cand, ci) => {
              const isSelected = directCandidates.get(expandedLevel) === ci;
              const isAutoMatch = ci === autoIdx;
              return (
                <div key={ci} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                  <div
                    role="button" tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDirectCandidates(prev => {
                        const next = new Map(prev);
                        if (next.get(expandedLevel) === ci) next.delete(expandedLevel);
                        else next.set(expandedLevel, ci);
                        return next;
                      });
                    }}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setDirectCandidates(prev => { const next = new Map(prev); if (next.get(expandedLevel) === ci) next.delete(expandedLevel); else next.set(expandedLevel, ci); return next; }); } }}
                    title={`#${cand.rgb.map(c => c.toString(16).padStart(2, "0")).join("")}`}
                    style={{
                      width: 32, height: 32, borderRadius: R.lg, cursor: "pointer",
                      background: `rgb(${cand.rgb.join(",")})`,
                      border: isSelected ? `3px solid ${C.accent}` : `1px solid ${C.border}`,
                      boxShadow: isSelected ? SHADOW.glow(C.accent) : "none",
                    }}
                  />
                  {/* F: Angle label */}
                  <span style={{ fontSize: FS.xxs, color: C.textDimmer }}>{Math.round(cand.angle)}°</span>
                  {/* G: Auto-match marker */}
                  {isAutoMatch && !isDirectMode && (
                    <div style={{ width: 6, height: 6, borderRadius: R.md, background: C.textPrimary }} title={t("title_auto_match")} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
      {/* Direct mode status */}
      {directCandidates.size > 0 && (
        <div style={{ fontSize: FS.sm, color: C.accent, textAlign: "center" }}>
          {Array.from(directCandidates.entries()).map(([lv]) =>
            `L${lv} ${LEVEL_INFO[lv].name}`
          ).join(", ")}
        </div>
      )}

      {/* Brush size */}
      {glazeTool !== "glaze_fill" && (
        <div style={{ display: "flex", alignItems: "center", gap: SP.lg, fontSize: FS.md, color: C.textDim, width: "100%" }}>
          <span>{t("label_size")}</span>
          <button style={S_BTN} onClick={() => setBrushSize(s => Math.max(BRUSH_MIN, s - BRUSH_STEP))}
            aria-label={t("aria_brush_size_decrease")}>-</button>
          <input type="range" min={BRUSH_MIN} max={BRUSH_MAX} step={BRUSH_STEP} value={brushSize}
            onChange={e => setBrushSize(Number(e.target.value))}
            aria-label={t("aria_brush_size")}
            style={{ flex: 1, accentColor: C.accent }} />
          <button style={S_BTN} onClick={() => setBrushSize(s => Math.min(BRUSH_MAX, s + BRUSH_STEP))}
            aria-label={t("aria_brush_size_increase")}>+</button>
          <span style={{ fontFamily: "monospace", width: 20, textAlign: "center" }}>{brushSize}</span>
        </div>
      )}

      {/* Options + Clear */}
      <div style={{ display: "flex", alignItems: "center", gap: SP.lg, flexWrap: "wrap", justifyContent: "center" }}>
        <label style={{ fontSize: FS.sm, color: C.textDim, cursor: "pointer", display: "flex", alignItems: "center", gap: SP.sm }}>
          <input type="checkbox" checked={showHighlight} onChange={e => setShowHighlight(e.target.checked)} />
          {t("glaze_show_highlight")}
        </label>
        <button style={S_BTN} onClick={handleGlazeClear} title={t("title_glaze_clear")}>
          {t("btn_glaze_clear")}
        </button>
        {glazeCount > 0 && (
          <span style={{ fontSize: FS.xs, color: C.textDimmer }}>
            {glazeCount.toLocaleString()}px
          </span>
        )}
      </div>
    </div>
  );
});
