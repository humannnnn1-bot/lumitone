import React, { useCallback } from "react";
import { TOOLS, BRUSH_MIN, BRUSH_MAX, BRUSH_STEP, ZOOM_MIN, ZOOM_MAX, MIN_TAP_SIZE } from "../constants";
import { LEVEL_INFO } from "../color-engine";
import { S_BTN, S_BTN_ACTIVE } from "../styles";
import { rgbStr, timestamp } from "../utils";
import type { AppState, ToolState, ViewState, SaveActions } from "../types";
import { useTranslation } from "../i18n";
import { C, Z, SP, FS, FW, R, O } from "../tokens";

interface SourcePanelProps {
  srcRef: React.RefObject<HTMLCanvasElement | null>;
  curRef: React.RefObject<HTMLCanvasElement | null>;
  srcWrapRef: React.RefObject<HTMLDivElement | null>;
  statusRef: React.RefObject<HTMLDivElement | null>;
  toolState: ToolState;
  viewState: ViewState;
  saveActions: SaveActions;
  colorLUT: [number, number, number][];
  state: AppState;
  onDown: (e: React.PointerEvent) => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: () => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  undo: () => void;
  redo: () => void;
  handleClear: () => void;
  loadImg: (file: File) => void;
  announce: (msg: string) => void;
  schedCursor: () => void;
  prvRef: React.RefObject<HTMLCanvasElement | null>;
  onNewCanvas: () => void;
  requestFilename: (defaultValue: string) => Promise<string | null>;
}

export const SourcePanel = React.memo(function SourcePanel(props: SourcePanelProps) {
  const {
    srcRef, curRef, srcWrapRef, statusRef,
    colorLUT, state,
    onDown, onMove, onUp, onPointerLeave,
    undo, redo, handleClear, loadImg,
    announce, schedCursor, prvRef, onNewCanvas, requestFilename,
  } = props;
  const { tool, setTool, brushLevel, setBrushLevel, brushSize, setBrushSize } = props.toolState;
  const { zoom, setZoom, setPan, displayW, displayH, canvasTransform, canvasCursor } = props.viewState;
  const { saveColor, saveGlaze } = props.saveActions;
  const { t } = useTranslation();

  const handleContextMenu = useCallback((e: React.MouseEvent) => e.preventDefault(), []);
  const handleZoomReset = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); schedCursor(); }, [setZoom, setPan, schedCursor]);
  const handleSizeDown = useCallback(() => setBrushSize(v => Math.max(BRUSH_MIN, v - BRUSH_STEP)), [setBrushSize]);
  const handleSizeUp = useCallback(() => setBrushSize(v => Math.min(BRUSH_MAX, v + BRUSH_STEP)), [setBrushSize]);
  const handleSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setBrushSize(+e.target.value), [setBrushSize]);
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) loadImg(e.target.files[0]); e.target.value = ""; }, [loadImg]);
  const handleSaveColor = useCallback(() => saveColor(prvRef, `chromalum_color_${timestamp()}.png`), [saveColor, prvRef]);
  const handleSaveGray = useCallback(() => saveColor(srcRef, `chromalum_gray_${timestamp()}.png`), [saveColor, srcRef]);
  const handleSaveGlaze = useCallback(() => saveGlaze(`chromalum_glaze_${timestamp()}.png`), [saveGlaze]);

  const handleZoomPixelPerfect = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.cvs.w / displayW));
    setZoom(z); setPan({ x: 0, y: 0 }); schedCursor();
  }, [state.cvs.w, displayW, setZoom, setPan, schedCursor]);

  const handleSaveColorCustom = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    requestFilename(`chromalum_color_${timestamp()}`).then(name => {
      if (name) saveColor(prvRef, name.endsWith(".png") ? name : name + ".png");
    });
  }, [saveColor, prvRef, requestFilename]);

  const handleSaveGrayCustom = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    requestFilename(`chromalum_gray_${timestamp()}`).then(name => {
      if (name) saveColor(srcRef, name.endsWith(".png") ? name : name + ".png");
    });
  }, [saveColor, srcRef, requestFilename]);

  const handleSaveGlazeCustom = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    requestFilename(`chromalum_glaze_${timestamp()}`).then(name => {
      if (name) saveGlaze(name.endsWith(".png") ? name : name + ".png");
    });
  }, [saveGlaze, requestFilename]);


  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg }}>
      <div style={{ fontSize: FS.md, color: C.textDim, minHeight: SP["3xl"] }}>{t("label_source")}</div>
      <div ref={srcWrapRef} style={{ border: `1px solid ${C.border}`, borderRadius: R.lg, overflow: "hidden", position: "relative", width: displayW, height: displayH }}>
        <canvas ref={srcRef}
          role="application" aria-label={t("aria_drawing_canvas")}
          style={{ width: displayW, height: displayH, display: "block", ...canvasTransform, cursor: canvasCursor, touchAction: "none" }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
          onPointerLeave={onPointerLeave}
          onContextMenu={handleContextMenu} />
        <canvas ref={curRef} width={displayW} height={displayH}
          style={{ position: "absolute", top: 0, left: 0, width: displayW, height: displayH, pointerEvents: "none", zIndex: Z.cursorOverlay }} />
      </div>
      <div ref={statusRef} aria-live="polite" aria-atomic="true" style={{ fontSize: FS.sm, color: C.textDimmest, fontFamily: "monospace", minHeight: 14, textAlign: "center" }}>{"\u2014"}</div>

      <div style={{ display: "flex", gap: SP.sm, flexWrap: "wrap", justifyContent: "center" }} role="radiogroup" aria-label={t("aria_drawing_tools")}>
        {TOOLS.map(tl =>
          <button key={tl.id} onClick={() => { setTool(tl.id); announce(t("announce_" + tl.id)); }} role="radio" aria-checked={tool === tl.id}
            style={tool === tl.id ? S_BTN_ACTIVE : S_BTN}>
            {t("tool_" + tl.id)}({tl.key})</button>)}
      </div>

      <div style={{ display: "flex", gap: SP.md }}>
        <button onClick={undo} disabled={!state.undoStack.length}
          style={{ ...S_BTN, opacity: state.undoStack.length ? 1 : O.disabled }} title={t("title_undo")}>{t("btn_undo")}</button>
        <button onClick={redo} disabled={!state.redoStack.length}
          style={{ ...S_BTN, opacity: state.redoStack.length ? 1 : O.disabled }} title={t("title_redo")}>{t("btn_redo")}</button>
        <button onClick={handleZoomReset} onContextMenu={handleZoomPixelPerfect} style={S_BTN}
          title={`${t("title_zoom_reset")} (${t("title_zoom_pixel")})`} aria-label={t("aria_zoom_reset", Math.round(zoom * 100))}>{"\u229B"}{Math.round(zoom * 100)}%</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: SP.lg, fontSize: 11, marginTop: SP.md, marginBottom: SP.md }}>
        <span style={{ color: C.textDimmer }}>{t("label_size")}</span>
        <button onClick={handleSizeDown}
          aria-label={t("aria_brush_size_decrease")}
          style={{ ...S_BTN, padding: "2px 8px", fontSize: 13, fontWeight: FW.bold, minWidth: MIN_TAP_SIZE, minHeight: MIN_TAP_SIZE, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{"\u2212"}</button>
        <input type="range" min={BRUSH_MIN} max={BRUSH_MAX} step={1} value={brushSize}
          aria-label={t("aria_brush_size")}
          onChange={handleSizeChange} style={{ flex: 1, maxWidth: 160, minWidth: 60 }} />
        <button onClick={handleSizeUp}
          aria-label={t("aria_brush_size_increase")}
          style={{ ...S_BTN, padding: "2px 8px", fontSize: 13, fontWeight: FW.bold, minWidth: MIN_TAP_SIZE, minHeight: MIN_TAP_SIZE, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>+</button>
        <span style={{ color: C.textSecondary, minWidth: 20 }}>{brushSize}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: SP.lg, justifyContent: "center" }}>
        <div style={{ width: 24, height: 24, borderRadius: R.lg, border: `2px solid ${C.accent}`,
          background: `rgb(${LEVEL_INFO[brushLevel].gray},${LEVEL_INFO[brushLevel].gray},${LEVEL_INFO[brushLevel].gray})` }} />
        <div style={{ fontSize: FS.md, color: C.textSecondary }}>{"\u2192"}</div>
        <div style={{ width: 24, height: 24, borderRadius: R.lg, border: `2px solid ${C.accent}`,
          background: rgbStr(colorLUT[brushLevel]) }} />
        <span style={{ fontSize: FS.sm, color: C.textDim }}>L{brushLevel} {LEVEL_INFO[brushLevel].name}</span>
      </div>

      <div style={{ display: "flex", gap: SP.sm }}>
        {LEVEL_INFO.map((info, i) =>
          <button key={i} onClick={() => { setBrushLevel(i); announce(t("announce_level", i, info.name)); }}
            onDoubleClick={() => { setBrushLevel(i); setTool(i === 0 ? "eraser" : "brush"); announce(t("announce_level", i, info.name)); }}
            aria-label={t("announce_level", i, info.name)}
            title={t("title_level_btn", i, info.name)}
            style={{ width: 30, height: 30, border: `2px solid ${brushLevel === i ? C.accent : C.border}`, borderRadius: R.lg, cursor: "pointer",
              background: `rgb(${info.gray},${info.gray},${info.gray})`, position: "relative" }}>
            <span style={{ position: "absolute", bottom: 1, right: 2, fontSize: FS.xs, color: info.gray > 128 ? "#000" : "#fff", fontWeight: FW.bold }}>{i}</span>
          </button>)}
      </div>

      <div style={{ display: "flex", gap: SP.lg, marginTop: SP.md, marginBottom: SP.md }}>
        <button onClick={onNewCanvas} style={S_BTN} title={t("title_new_canvas")}>{t("btn_new")}</button>
        <label style={{ ...S_BTN, border: `1px solid ${C.accentDim}`, color: C.loadBtn }}>{t("btn_load")}<input type="file" accept="image/*" aria-label={t("aria_open_image")} onChange={handleFileChange} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }} /></label>
        <button onClick={handleClear} style={S_BTN} title={t("title_clear")}>{t("btn_clear")}</button>
      </div>

      <div style={{ display: "flex", gap: SP.md, justifyContent: "center" }}>
        <button onClick={handleSaveGray} onContextMenu={handleSaveGrayCustom} style={S_BTN} title={t("title_save_gray")}>{t("btn_save_gray")}</button>
        <button onClick={handleSaveColor} onContextMenu={handleSaveColorCustom} style={{ ...S_BTN, color: C.saveColor }} title={t("title_save_color")}>{t("btn_save_color")}</button>
        <button onClick={handleSaveGlaze} onContextMenu={handleSaveGlazeCustom} style={{ ...S_BTN, color: C.saveGlaze }} title={t("title_save_glaze")}>{t("btn_save_glaze")}</button>
      </div>
    </div>
  );
});
