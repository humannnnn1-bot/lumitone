import React, { useCallback } from "react";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "../constants";
import type { ToolId } from "../constants";
import { ColorMappingList } from "./ColorMappingList";
import type { ColorAction } from "../state/color-reducer";
import type { PanZoomHandlers, DrawingHandlers } from "../types";
import { useTranslation } from "../i18n";
import { S_CANVAS_STATUS_STABLE, S_CHECKERBOARD, S_PANEL_SUBTITLE } from "../styles/shared";
import { C, Z, SP, R } from "../styles/tokens";
import { getCanvasPanelClassName, getCanvasPanelStyle, getPanelLayoutClassName } from "../utils/panel-layout";

interface ColorPanelProps {
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  previewCursorRef: React.RefObject<HTMLCanvasElement | null>;
  previewCanvasWrapRef: React.RefObject<HTMLDivElement | null>;
  statusRef: React.RefObject<HTMLDivElement | null>;
  displayWidth: number;
  displayHeight: number;
  canvasTransform: React.CSSProperties;
  canvasCursor: string;
  candidateIndexByLevel: readonly number[];
  candidateIndexDispatch: React.Dispatch<ColorAction>;
  brushLevel: number;
  setBrushLevel: (lv: number) => void;
  tool: ToolId;
  panZoom: PanZoomHandlers;
  drawing: DrawingHandlers;
}

export const ColorPanel = React.memo(function ColorPanel(props: ColorPanelProps) {
  const {
    previewCanvasRef,
    previewCursorRef,
    previewCanvasWrapRef,
    statusRef,
    displayWidth,
    displayHeight,
    canvasTransform,
    canvasCursor,
    candidateIndexByLevel,
    candidateIndexDispatch,
    brushLevel,
    setBrushLevel,
    tool,
    panZoom,
    drawing,
  } = props;
  const { t } = useTranslation();

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        panZoom.setZoom((z) => Math.min(ZOOM_MAX, z * ZOOM_STEP));
        panZoom.scheduleCursorRedrawRef.current?.();
      } else if (e.key === "-") {
        e.preventDefault();
        panZoom.setZoom((z) => Math.max(ZOOM_MIN, z / ZOOM_STEP));
        panZoom.scheduleCursorRedrawRef.current?.();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        panZoom.setPan((p) => ({ ...p, x: p.x + 10 }));
        panZoom.scheduleCursorRedrawRef.current?.();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        panZoom.setPan((p) => ({ ...p, x: p.x - 10 }));
        panZoom.scheduleCursorRedrawRef.current?.();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        panZoom.setPan((p) => ({ ...p, y: p.y + 10 }));
        panZoom.scheduleCursorRedrawRef.current?.();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        panZoom.setPan((p) => ({ ...p, y: p.y - 10 }));
        panZoom.scheduleCursorRedrawRef.current?.();
      } else if (e.key === "0") {
        e.preventDefault();
        panZoom.setZoom(1);
        panZoom.setPan({ x: 0, y: 0 });
        panZoom.scheduleCursorRedrawRef.current?.();
      }
    },
    [panZoom],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1) {
        panZoom.handleMiddleDown(e);
        return;
      }
      if (panZoom.spaceRef.current) {
        e.preventDefault();
        panZoom.startPan(e);
        return;
      }
      drawing.onPreviewPointerDown(e);
    },
    [panZoom, drawing],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (panZoom.panningRef.current) {
        panZoom.movePan(e);
        return;
      }
      drawing.onPreviewPointerMove(e);
    },
    [panZoom, drawing],
  );

  const handlePointerUp = useCallback(() => {
    if (panZoom.panningRef.current) {
      panZoom.endPan();
      return;
    }
    drawing.onUp();
  }, [panZoom, drawing]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => e.preventDefault(), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg }}>
      <div style={S_PANEL_SUBTITLE}>
        <span style={{ position: "relative", display: "inline-block" }}>
          {t("label_colorized")}
          <span style={{ position: "absolute", left: "100%", marginLeft: SP.xl, color: C.textDimmest }}>
            {t("tool_" + tool)
              .replace(/[A-Za-z\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f]+/g, "")
              .trim()}
          </span>
        </span>
      </div>
      <div className={getPanelLayoutClassName(displayWidth, displayHeight)}>
        <div className={getCanvasPanelClassName(displayWidth, displayHeight)} style={getCanvasPanelStyle(displayWidth, displayHeight)}>
          <div
            className="canvas-workspace"
            ref={previewCanvasWrapRef}
            tabIndex={0}
            aria-label={t("aria_color_preview")}
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={drawing.onPreviewPointerLeave}
            onMouseLeave={drawing.clearPreviewCursor}
            onContextMenu={handleContextMenu}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: R.lg,
              overflow: "hidden",
              position: "relative",
              width: displayWidth,
              height: displayHeight,
              cursor: canvasCursor,
              touchAction: "none",
              ...S_CHECKERBOARD,
            }}
          >
            <canvas
              ref={previewCanvasRef}
              role="img"
              aria-label={t("aria_color_preview_canvas")}
              style={{
                width: displayWidth,
                height: displayHeight,
                display: "block",
                ...canvasTransform,
                cursor: canvasCursor,
                touchAction: "none",
              }}
            />
            <canvas
              className="canvas-cursor-overlay"
              ref={previewCursorRef}
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
        <div className="panel-sidebar" style={{ marginTop: SP.xl }}>
          <ColorMappingList
            candidateIndexByLevel={candidateIndexByLevel}
            dispatch={candidateIndexDispatch}
            brushLevel={brushLevel}
            onSelectLevel={setBrushLevel}
          />
        </div>
      </div>
    </div>
  );
});
