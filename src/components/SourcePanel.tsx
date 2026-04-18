import React, { useCallback, useState } from "react";
import { TOOLS, BRUSH_MIN, BRUSH_MAX, BRUSH_STEP, ZOOM_MIN, ZOOM_MAX } from "../constants";
import { LEVEL_INFO } from "../color-engine";
import { S_BTN, S_BTN_ACTIVE, S_CHECKERBOARD } from "../styles";
import { rgbStr, timestamp } from "../utils";
import type { AppState, ToolState, ViewState, SaveActions } from "../types";
import { useTranslation } from "../i18n";
import { C, Z, SP, FS, FW, R, O } from "../tokens";
import { ConfirmModal } from "./ConfirmModal";

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
  panZoomMode: boolean;
  setPanZoomMode: React.Dispatch<React.SetStateAction<boolean>>;
  handleMiddleDown: (e: React.PointerEvent) => void;
  onPinchDown: (e: React.PointerEvent) => void;
  onPinchMove: (e: React.PointerEvent) => void;
  onPinchUp: (e: React.PointerEvent) => void;
}

export const SourcePanel = React.memo(function SourcePanel(props: SourcePanelProps) {
  const {
    srcRef,
    curRef,
    srcWrapRef,
    statusRef,
    colorLUT,
    state,
    onDown,
    onMove,
    onUp,
    onPointerLeave,
    undo,
    redo,
    handleClear,
    loadImg,
    announce,
    schedCursor,
    prvRef,
    onNewCanvas,
    panZoomMode,
    setPanZoomMode,
    handleMiddleDown,
    onPinchDown,
    onPinchMove,
    onPinchUp,
  } = props;
  const { tool, setTool, brushLevel, setBrushLevel, brushSize, setBrushSize } = props.toolState;
  const { zoom, setZoom, setPan, displayW, displayH, canvasTransform, canvasCursor } = props.viewState;
  const { saveColor, saveGlaze, shareColor, shareGlaze } = props.saveActions;
  const { t } = useTranslation();

  const handleContextMenu = useCallback((e: React.MouseEvent) => e.preventDefault(), []);
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1) {
        handleMiddleDown(e);
        return;
      }
      (panZoomMode ? onPinchDown : onDown)(e);
    },
    [handleMiddleDown, panZoomMode, onPinchDown, onDown],
  );
  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    schedCursor();
  }, [setZoom, setPan, schedCursor]);
  const handleSizeDown = useCallback(() => setBrushSize((v) => Math.max(BRUSH_MIN, v - BRUSH_STEP)), [setBrushSize]);
  const handleSizeUp = useCallback(() => setBrushSize((v) => Math.min(BRUSH_MAX, v + BRUSH_STEP)), [setBrushSize]);
  const handleSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setBrushSize(+e.target.value), [setBrushSize]);
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) loadImg(e.target.files[0]);
      e.target.value = "";
    },
    [loadImg],
  );
  const [confirmSave, setConfirmSave] = useState<"gray" | "color" | "glaze" | null>(null);
  const doSave = useCallback(
    (kind: "gray" | "color" | "glaze") => {
      const ts = timestamp();
      if (kind === "gray") saveColor(srcRef, `chromalum_gray_${ts}.png`);
      else if (kind === "color") saveColor(prvRef, `chromalum_color_${ts}.png`);
      else saveGlaze(`chromalum_glaze_${ts}.png`);
    },
    [saveColor, saveGlaze, srcRef, prvRef],
  );
  // Touch devices get a confirm step (hard to cancel an accidental share sheet on mobile);
  // pointer-fine (mouse) saves immediately as before.
  const requestSave = useCallback(
    (kind: "gray" | "color" | "glaze") => {
      if (window.matchMedia("(pointer: fine)").matches) doSave(kind);
      else setConfirmSave(kind);
    },
    [doSave],
  );
  const handleSaveColor = useCallback(() => requestSave("color"), [requestSave]);
  const handleSaveGray = useCallback(() => requestSave("gray"), [requestSave]);
  const handleSaveGlaze = useCallback(() => requestSave("glaze"), [requestSave]);
  const handleConfirmSave = useCallback(() => {
    if (confirmSave) doSave(confirmSave);
    setConfirmSave(null);
  }, [confirmSave, doSave]);
  const handleCancelSave = useCallback(() => setConfirmSave(null), []);
  const confirmMsg =
    confirmSave === "gray"
      ? t("confirm_save_gray")
      : confirmSave === "color"
        ? t("confirm_save_color")
        : confirmSave === "glaze"
          ? t("confirm_save_glaze")
          : "";

  // Right-click on desktop opens the OS share sheet. Suppressed on touch-primary devices
  // (mobile/tablet) since their default left-tap already routes to the share sheet on iOS.
  const handleShareColor = useCallback(
    (e: React.MouseEvent) => {
      if (!window.matchMedia("(pointer: fine)").matches) return;
      e.preventDefault();
      shareColor(prvRef, `chromalum_color_${timestamp()}.png`);
    },
    [shareColor, prvRef],
  );
  const handleShareGray = useCallback(
    (e: React.MouseEvent) => {
      if (!window.matchMedia("(pointer: fine)").matches) return;
      e.preventDefault();
      shareColor(srcRef, `chromalum_gray_${timestamp()}.png`);
    },
    [shareColor, srcRef],
  );
  const handleShareGlaze = useCallback(
    (e: React.MouseEvent) => {
      if (!window.matchMedia("(pointer: fine)").matches) return;
      e.preventDefault();
      shareGlaze(`chromalum_glaze_${timestamp()}.png`);
    },
    [shareGlaze],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPan((p) => ({ ...p, x: p.x + 10 }));
        schedCursor();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPan((p) => ({ ...p, x: p.x - 10 }));
        schedCursor();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setPan((p) => ({ ...p, y: p.y + 10 }));
        schedCursor();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setPan((p) => ({ ...p, y: p.y - 10 }));
        schedCursor();
      }
    },
    [setPan, schedCursor],
  );

  const handleZoomPixelPerfect = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const exact = state.cvs.w / displayW;
      // If exact 1:1 ratio fits within limits, use it; otherwise pick the
      // largest integer multiple that stays within ZOOM_MAX.
      const z = exact <= ZOOM_MAX ? Math.max(ZOOM_MIN, exact) : Math.max(ZOOM_MIN, Math.floor(ZOOM_MAX));
      setZoom(z);
      setPan({ x: 0, y: 0 });
      schedCursor();
    },
    [state.cvs.w, displayW, setZoom, setPan, schedCursor],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg }}>
      <div className="panel-layout">
        <div className="panel-canvas" style={{ "--display-max": displayW + "px" } as React.CSSProperties}>
          <div style={{ fontSize: FS.md, color: C.textDim, textAlign: "center", lineHeight: "14px" }}>{t("label_source")}</div>
          <div
            ref={srcWrapRef}
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
              ref={srcRef}
              role="application"
              aria-label={t("aria_drawing_canvas")}
              aria-roledescription={t("aria_drawing_canvas_desc")}
              style={{
                width: displayW,
                height: displayH,
                display: "block",
                ...canvasTransform,
                cursor: panZoomMode ? "grab" : canvasCursor,
                touchAction: "none",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={panZoomMode ? onPinchMove : onMove}
              onPointerUp={panZoomMode ? onPinchUp : onUp}
              onPointerLeave={panZoomMode ? onPinchUp : onPointerLeave}
              onContextMenu={handleContextMenu}
            />
            <canvas
              ref={curRef}
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
            ref={statusRef}
            aria-live="polite"
            aria-atomic="true"
            style={{ fontSize: FS.sm, color: C.textDimmest, fontFamily: "monospace", minHeight: 14, textAlign: "center" }}
          >
            {"\u2014"}
          </div>
        </div>
        <div className="panel-sidebar">
          <div
            role="radiogroup"
            aria-label={t("aria_drawing_tools")}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg }}
          >
            <div style={{ display: "flex", gap: SP.lg, justifyContent: "center" }}>
              {TOOLS.slice(0, 3).map((tl) => (
                <button
                  key={tl.id}
                  onClick={() => {
                    setTool(tl.id);
                    if (panZoomMode) setPanZoomMode(false);
                    announce(t("announce_" + tl.id));
                  }}
                  role="radio"
                  aria-checked={tool === tl.id}
                  style={tool === tl.id ? S_BTN_ACTIVE : S_BTN}
                >
                  {t("tool_" + tl.id)}({tl.key})
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: SP.lg, justifyContent: "center" }}>
              {TOOLS.slice(3).map((tl) => (
                <button
                  key={tl.id}
                  onClick={() => {
                    setTool(tl.id);
                    if (panZoomMode) setPanZoomMode(false);
                    announce(t("announce_" + tl.id));
                  }}
                  role="radio"
                  aria-checked={tool === tl.id}
                  style={tool === tl.id ? S_BTN_ACTIVE : S_BTN}
                >
                  {t("tool_" + tl.id)}({tl.key})
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: SP.lg, flexWrap: "wrap", justifyContent: "center", marginTop: SP["2xl"] }}>
            <button
              onClick={undo}
              disabled={!state.undoStack.length}
              style={{ ...S_BTN, opacity: state.undoStack.length ? 1 : O.disabled }}
              title={t("title_undo")}
            >
              {t("btn_undo")}
            </button>
            <button
              onClick={redo}
              disabled={!state.redoStack.length}
              style={{ ...S_BTN, opacity: state.redoStack.length ? 1 : O.disabled }}
              title={t("title_redo")}
            >
              {t("btn_redo")}
            </button>
            <button
              onClick={handleZoomReset}
              onContextMenu={handleZoomPixelPerfect}
              style={{ ...S_BTN, lineHeight: 1, gap: SP.xs, marginLeft: SP.lg }}
              title={`${t("title_zoom_reset")} (${t("title_zoom_pixel")})`}
              aria-label={t("aria_zoom_reset", Math.round(zoom * 100))}
            >
              <span>{"\u25CE"}</span>
              <span>{Math.round(zoom * 100)}%</span>
            </button>
            <button onClick={() => setPanZoomMode((prev) => !prev)} style={panZoomMode ? S_BTN_ACTIVE : S_BTN}>
              {t("btn_pan_mode")}
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: SP.lg,
              fontSize: 11,
              marginTop: SP["2xl"],
              marginBottom: SP.md,
              width: "100%",
            }}
          >
            <span style={{ color: C.textDimmer }}>{t("label_size")}</span>
            <button
              onClick={handleSizeDown}
              aria-label={t("aria_brush_size_decrease")}
              style={{ ...S_BTN, padding: "2px 6px", fontSize: 13, fontWeight: FW.bold }}
            >
              {"\u2212"}
            </button>
            <input
              type="range"
              min={BRUSH_MIN}
              max={BRUSH_MAX}
              step={1}
              value={brushSize}
              aria-label={t("aria_brush_size")}
              onChange={handleSizeChange}
              style={{ flex: 1, minWidth: 60 }}
            />
            <button
              onClick={handleSizeUp}
              aria-label={t("aria_brush_size_increase")}
              style={{ ...S_BTN, padding: "2px 6px", fontSize: 13, fontWeight: FW.bold }}
            >
              +
            </button>
            <span style={{ color: C.textSecondary, minWidth: 20 }}>{brushSize}</span>
          </div>

          {/* Level indicator + buttons (grouped) */}
          <div style={{ display: "flex", alignItems: "center", gap: SP.lg, justifyContent: "center", marginTop: SP["2xl"] }}>
            <span style={{ fontSize: FS.sm, color: C.textDim }}>{t("label_input")}</span>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: R.lg,
                border: `2px solid ${C.accent}`,
                background: `rgb(${LEVEL_INFO[brushLevel].gray},${LEVEL_INFO[brushLevel].gray},${LEVEL_INFO[brushLevel].gray})`,
              }}
            />
            <div style={{ fontSize: FS.md, color: C.textSecondary, lineHeight: 1, display: "flex", alignItems: "center" }}>{"\u2192"}</div>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: R.lg,
                border: `2px solid ${C.accent}`,
                background: rgbStr(colorLUT[brushLevel]),
              }}
            />
            <span style={{ fontSize: FS.sm, color: C.textDim }}>{t("label_output")}</span>
          </div>

          <div style={{ display: "flex", gap: SP.sm, justifyContent: "center", maxWidth: "100%", marginTop: SP.xl, marginBottom: SP.md }}>
            {LEVEL_INFO.map((info, i) => (
              <button
                key={i}
                onClick={() => {
                  setBrushLevel(i);
                  announce(t("announce_level", i, info.name));
                }}
                onDoubleClick={() => {
                  setBrushLevel(i);
                  setTool(i === 0 ? "eraser" : "brush");
                  announce(t("announce_level", i, info.name));
                }}
                aria-label={t("announce_level", i, info.name)}
                title={t("title_level_btn", i, info.name)}
                style={{
                  flex: "1 1 0",
                  minWidth: 36,
                  maxWidth: 44,
                  aspectRatio: "1",
                  border: `2px solid ${brushLevel === i ? C.accent : C.border}`,
                  borderRadius: R.lg,
                  cursor: "pointer",
                  background: `rgb(${info.gray},${info.gray},${info.gray})`,
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    bottom: 1,
                    right: 2,
                    fontSize: FS.xs,
                    color: info.gray > 128 ? "#000" : "#fff",
                    fontWeight: FW.bold,
                  }}
                >
                  {i}
                </span>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: SP.lg, flexWrap: "wrap", justifyContent: "center", marginTop: SP["3xl"] }}>
            <button onClick={onNewCanvas} style={S_BTN} title={t("title_new_canvas")}>
              {t("btn_new")}
            </button>
            <label
              style={{
                ...S_BTN,
                border: `1px solid ${C.accentDim}`,
                color: C.loadBtn,
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {t("btn_load")}
              <input
                type="file"
                accept="image/*"
                aria-label={t("aria_open_image")}
                onChange={handleFileChange}
                style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
              />
            </label>
            <button onClick={handleClear} style={S_BTN} title={t("title_clear")}>
              {t("btn_clear")}
            </button>
          </div>

          <div style={{ display: "flex", gap: SP.md, justifyContent: "center", flexWrap: "wrap", marginTop: SP["5xl"] }}>
            <button onClick={handleSaveGray} onContextMenu={handleShareGray} style={S_BTN} title={t("title_save_gray")}>
              {t("btn_save_gray")}
            </button>
            <button
              onClick={handleSaveColor}
              onContextMenu={handleShareColor}
              style={{ ...S_BTN, color: C.saveColor }}
              title={t("title_save_color")}
            >
              {t("btn_save_color")}
            </button>
            <button
              onClick={handleSaveGlaze}
              onContextMenu={handleShareGlaze}
              style={{ ...S_BTN, color: C.saveGlaze }}
              title={t("title_save_glaze")}
            >
              {t("btn_save_glaze")}
            </button>
          </div>
        </div>
        {/* panel-sidebar */}
      </div>
      {/* panel-layout */}
      <ConfirmModal open={confirmSave !== null} message={confirmMsg} onConfirm={handleConfirmSave} onCancel={handleCancelSave} />
    </div>
  );
});
