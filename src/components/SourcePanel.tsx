import React, { useCallback, useState } from "react";
import { TOOLS, BRUSH_MIN, BRUSH_MAX, BRUSH_STEP, ZOOM_MIN, ZOOM_MAX } from "../constants";
import { LEVEL_INFO } from "../color-engine";
import { S_BTN, S_BTN_ACTIVE, S_CANVAS_STATUS_STABLE, S_CHECKERBOARD, S_PANEL_SUBTITLE } from "../styles/shared";
import { rgbStr, timestamp } from "../utils";
import type { AppState, ToolState, ViewState, SaveActions } from "../types";
import { useTranslation } from "../i18n";
import { C, Z, SP, FS, FW, R, O } from "../styles/tokens";
import { ConfirmModal } from "./ConfirmModal";
import { getCanvasPanelClassName, getCanvasPanelStyle, getPanelLayoutClassName } from "../utils/panel-layout";

interface SourcePanelProps {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  cursorCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  sourceCanvasWrapRef: React.RefObject<HTMLDivElement | null>;
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
  clearCursor: () => void;
  undo: () => void;
  redo: () => void;
  handleClear: () => void;
  loadImg: (file: File) => Promise<void>;
  announce: (msg: string) => void;
  scheduleCursorRedraw: () => void;
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  onNewCanvas: () => void;
  panZoomMode: boolean;
  setPanZoomMode: React.Dispatch<React.SetStateAction<boolean>>;
  handleMiddleDown: (e: React.PointerEvent) => void;
  onPinchDown: (e: React.PointerEvent) => void;
  onPinchMove: (e: React.PointerEvent) => void;
  onPinchUp: (e: React.PointerEvent) => void;
}

type FilePickerHandle = { getFile: () => Promise<File> };
type WindowWithFilePicker = Window & {
  showOpenFilePicker?: (options?: {
    excludeAcceptAllOption?: boolean;
    multiple?: boolean;
    startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<FilePickerHandle[]>;
};
const S_SOURCE_ACTION_BUTTON_BASE: React.CSSProperties = {
  boxSizing: "border-box",
  height: 22,
  minHeight: 22,
  padding: "0 6px",
  fontSize: FS.lg,
  lineHeight: "20px",
  whiteSpace: "nowrap",
};
const S_SOURCE_ACTION_BUTTON: React.CSSProperties = { ...S_BTN, ...S_SOURCE_ACTION_BUTTON_BASE };
const S_SOURCE_ACTION_BUTTON_ACTIVE: React.CSSProperties = { ...S_BTN_ACTIVE, ...S_SOURCE_ACTION_BUTTON_BASE };
const S_SOURCE_FILE_BUTTON: React.CSSProperties = { ...S_SOURCE_ACTION_BUTTON, minWidth: 52 };
export const SourcePanel = React.memo(function SourcePanel(props: SourcePanelProps) {
  const {
    sourceCanvasRef,
    cursorCanvasRef,
    sourceCanvasWrapRef,
    statusRef,
    colorLUT,
    state,
    onDown,
    onMove,
    onUp,
    onPointerLeave,
    clearCursor,
    undo,
    redo,
    handleClear,
    loadImg,
    announce,
    scheduleCursorRedraw,
    previewCanvasRef,
    onNewCanvas,
    panZoomMode,
    setPanZoomMode,
    handleMiddleDown,
    onPinchDown,
    onPinchMove,
    onPinchUp,
  } = props;
  const { tool, setTool, brushLevel, setBrushLevel, brushSize, setBrushSize } = props.toolState;
  const { zoom, setZoom, setPan, displayWidth, displayHeight, canvasTransform, canvasCursor } = props.viewState;
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
    scheduleCursorRedraw();
  }, [setZoom, setPan, scheduleCursorRedraw]);
  const handleSizeDown = useCallback(() => setBrushSize((v) => Math.max(BRUSH_MIN, v - BRUSH_STEP)), [setBrushSize]);
  const handleSizeUp = useCallback(() => setBrushSize((v) => Math.min(BRUSH_MAX, v + BRUSH_STEP)), [setBrushSize]);
  const handleSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setBrushSize(+e.target.value), [setBrushSize]);
  const handleOpenImage = useCallback(() => {
    const openWithInput = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.position = "fixed";
      input.style.left = "-10000px";
      input.style.top = "0";
      document.body.appendChild(input);

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        window.removeEventListener("focus", handleFocus);
        input.remove();
      };
      const handleFocus = () => {
        window.setTimeout(() => {
          if (!input.files?.length) cleanup();
        }, 1000);
      };

      input.addEventListener(
        "change",
        () => {
          window.removeEventListener("focus", handleFocus);
          const file = input.files?.[0];
          if (!file) {
            cleanup();
            return;
          }
          void loadImg(file).finally(cleanup);
        },
        { once: true },
      );
      window.addEventListener("focus", handleFocus, { once: true });
      input.click();
    };

    const picker = (window as WindowWithFilePicker).showOpenFilePicker;
    if (window.isSecureContext && typeof picker === "function") {
      void picker({
        excludeAcceptAllOption: true,
        multiple: false,
        startIn: "pictures",
        types: [
          {
            description: "Images",
            accept: {
              "image/bmp": [".bmp"],
              "image/gif": [".gif"],
              "image/jpeg": [".jpg", ".jpeg"],
              "image/png": [".png"],
              "image/webp": [".webp"],
            },
          },
        ],
      })
        .then(async (handles) => {
          const file = await handles[0]?.getFile();
          if (file) await loadImg(file);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          openWithInput();
        });
      return;
    }

    openWithInput();
  }, [loadImg]);
  const [confirmSave, setConfirmSave] = useState<"gray" | "color" | "glaze" | null>(null);
  const doSave = useCallback(
    (kind: "gray" | "color" | "glaze") => {
      const ts = timestamp();
      if (kind === "gray") saveColor(sourceCanvasRef, `chromalum_gray_${ts}.png`);
      else if (kind === "color") saveColor(previewCanvasRef, `chromalum_color_${ts}.png`);
      else saveGlaze(`chromalum_glaze_${ts}.png`);
    },
    [saveColor, saveGlaze, sourceCanvasRef, previewCanvasRef],
  );
  const requestSave = useCallback((kind: "gray" | "color" | "glaze") => {
    setConfirmSave(kind);
  }, []);
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
      shareColor(previewCanvasRef, `chromalum_color_${timestamp()}.png`);
    },
    [shareColor, previewCanvasRef],
  );
  const handleShareGray = useCallback(
    (e: React.MouseEvent) => {
      if (!window.matchMedia("(pointer: fine)").matches) return;
      e.preventDefault();
      shareColor(sourceCanvasRef, `chromalum_gray_${timestamp()}.png`);
    },
    [shareColor, sourceCanvasRef],
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
        scheduleCursorRedraw();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPan((p) => ({ ...p, x: p.x - 10 }));
        scheduleCursorRedraw();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setPan((p) => ({ ...p, y: p.y + 10 }));
        scheduleCursorRedraw();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setPan((p) => ({ ...p, y: p.y - 10 }));
        scheduleCursorRedraw();
      }
    },
    [setPan, scheduleCursorRedraw],
  );

  const handleZoomPixelPerfect = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const exact = state.canvasData.width / displayWidth;
      // If exact 1:1 ratio fits within limits, use it; otherwise pick the
      // largest integer multiple that stays within ZOOM_MAX.
      const z = exact <= ZOOM_MAX ? Math.max(ZOOM_MIN, exact) : Math.max(ZOOM_MIN, Math.floor(ZOOM_MAX));
      setZoom(z);
      setPan({ x: 0, y: 0 });
      scheduleCursorRedraw();
    },
    [state.canvasData.width, displayWidth, setZoom, setPan, scheduleCursorRedraw],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg }}>
      <div style={S_PANEL_SUBTITLE}>{t("label_source")}</div>
      <div className={getPanelLayoutClassName(displayWidth, displayHeight)}>
        <div className={getCanvasPanelClassName(displayWidth, displayHeight)} style={getCanvasPanelStyle(displayWidth, displayHeight)}>
          <div
            className="canvas-workspace"
            ref={sourceCanvasWrapRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={panZoomMode ? onPinchMove : onMove}
            onPointerUp={panZoomMode ? onPinchUp : onUp}
            onPointerLeave={panZoomMode ? onPinchUp : onPointerLeave}
            onMouseLeave={clearCursor}
            onContextMenu={handleContextMenu}
            style={{
              border: panZoomMode ? `1px solid ${C.accentBright}` : `1px solid ${C.border}`,
              borderRadius: R.lg,
              overflow: "hidden",
              position: "relative",
              width: displayWidth,
              height: displayHeight,
              outline: "none",
              cursor: panZoomMode ? "grab" : canvasCursor,
              touchAction: "none",
              ...S_CHECKERBOARD,
            }}
          >
            <canvas
              ref={sourceCanvasRef}
              role="application"
              aria-label={t("aria_drawing_canvas")}
              aria-roledescription={t("aria_drawing_canvas_desc")}
              style={{
                width: displayWidth,
                height: displayHeight,
                display: "block",
                ...canvasTransform,
                cursor: panZoomMode ? "grab" : canvasCursor,
                touchAction: "none",
              }}
            />
            <canvas
              className="canvas-cursor-overlay"
              ref={cursorCanvasRef}
              width={displayWidth}
              height={displayHeight}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: displayWidth,
                height: displayHeight,
                pointerEvents: "none",
                zIndex: Z.cursorOverlay,
              }}
            />
          </div>
          <div ref={statusRef} aria-live="polite" aria-atomic="true" style={S_CANVAS_STATUS_STABLE}>
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
                  style={tool === tl.id ? S_SOURCE_ACTION_BUTTON_ACTIVE : S_SOURCE_ACTION_BUTTON}
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
                  style={tool === tl.id ? S_SOURCE_ACTION_BUTTON_ACTIVE : S_SOURCE_ACTION_BUTTON}
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
              style={{ ...S_SOURCE_ACTION_BUTTON, opacity: state.undoStack.length ? 1 : O.disabled }}
              title={t("title_undo")}
            >
              {t("btn_undo")}
            </button>
            <button
              onClick={redo}
              disabled={!state.redoStack.length}
              style={{ ...S_SOURCE_ACTION_BUTTON, opacity: state.redoStack.length ? 1 : O.disabled }}
              title={t("title_redo")}
            >
              {t("btn_redo")}
            </button>
            <button
              onClick={handleZoomReset}
              onContextMenu={handleZoomPixelPerfect}
              style={{ ...S_SOURCE_ACTION_BUTTON, gap: SP.xs, marginLeft: SP.lg }}
              title={`${t("title_zoom_reset")} (${t("title_zoom_pixel")})`}
              aria-label={t("aria_zoom_reset", Math.round(zoom * 100))}
            >
              <span>{"\u25CE"}</span>
              <span>{Math.round(zoom * 100)}%</span>
            </button>
            <button
              onClick={() => setPanZoomMode((prev) => !prev)}
              style={panZoomMode ? S_SOURCE_ACTION_BUTTON_ACTIVE : S_SOURCE_ACTION_BUTTON}
            >
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
            <button onClick={handleSizeDown} aria-label={t("aria_brush_size_decrease")} style={S_BTN}>
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
            <button onClick={handleSizeUp} aria-label={t("aria_brush_size_increase")} style={S_BTN}>
              +
            </button>
            <span style={{ color: C.textSecondary, minWidth: 20 }}>{brushSize}</span>
          </div>

          {/* Level palette + selected mapping */}
          <div
            style={{
              display: "flex",
              gap: SP.sm,
              justifyContent: "center",
              maxWidth: "100%",
              marginTop: SP["2xl"],
              transform: "translateY(-1px)",
            }}
          >
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

          <div style={{ display: "flex", alignItems: "center", gap: SP.lg, justifyContent: "center", marginTop: SP.xl }}>
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

          <div style={{ display: "flex", gap: SP.lg, flexWrap: "wrap", justifyContent: "center", marginTop: SP["3xl"] + 2 }}>
            <button onClick={onNewCanvas} style={S_SOURCE_FILE_BUTTON} title={t("title_new_canvas")}>
              {t("btn_new")}
            </button>
            <button
              type="button"
              onClick={handleOpenImage}
              aria-label={t("aria_open_image")}
              style={{
                ...S_SOURCE_FILE_BUTTON,
                border: `1px solid ${C.accentDim}`,
                color: C.loadBtn,
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {t("btn_load")}
            </button>
            <button onClick={handleClear} style={S_SOURCE_FILE_BUTTON} title={t("title_clear")}>
              {t("btn_clear")}
            </button>
          </div>

          <div style={{ display: "flex", gap: SP.md, justifyContent: "center", flexWrap: "wrap", marginTop: SP["5xl"] }}>
            <button
              onClick={handleSaveGray}
              onContextMenu={handleShareGray}
              style={S_SOURCE_ACTION_BUTTON}
              title={`${t("title_save_gray")} (${t("title_share")})`}
            >
              {t("btn_save_gray")}
            </button>
            <button
              onClick={handleSaveColor}
              onContextMenu={handleShareColor}
              style={{ ...S_SOURCE_ACTION_BUTTON, color: C.saveColor }}
              title={`${t("title_save_color")} (${t("title_share")})`}
            >
              {t("btn_save_color")}
            </button>
            <button
              onClick={handleSaveGlaze}
              onContextMenu={handleShareGlaze}
              style={{ ...S_SOURCE_ACTION_BUTTON, color: C.saveGlaze }}
              title={`${t("title_save_glaze")} (${t("title_share")})`}
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
