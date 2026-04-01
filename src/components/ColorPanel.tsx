import React, { useCallback } from "react";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "../constants";
import type { ToolId } from "../constants";
import { ColorMappingList } from "./ColorMappingList";
import type { ColorAction } from "../color-reducer";
import type { PanZoomHandlers, DrawingHandlers } from "../types";
import { useTranslation } from "../i18n";
import { S_CHECKERBOARD } from "../styles";
import { C, Z, SP, FS, R } from "../tokens";

interface ColorPanelProps {
  prvRef: React.RefObject<HTMLCanvasElement | null>;
  prvCurRef: React.RefObject<HTMLCanvasElement | null>;
  prvWrapRef: React.RefObject<HTMLDivElement | null>;
  displayW: number;
  displayH: number;
  canvasTransform: React.CSSProperties;
  canvasCursor: string;
  cc: number[];
  ccDispatch: React.Dispatch<ColorAction>;
  brushLevel: number;
  setBrushLevel: (lv: number) => void;
  tool: ToolId;
  panZoom: PanZoomHandlers;
  drawing: DrawingHandlers;
}

export const ColorPanel = React.memo(function ColorPanel(props: ColorPanelProps) {
  const {
    prvRef,
    prvCurRef,
    prvWrapRef,
    displayW,
    displayH,
    canvasTransform,
    canvasCursor,
    cc,
    ccDispatch,
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
    [panZoom],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1 || panZoom.spaceRef.current) {
        e.preventDefault();
        panZoom.startPan(e);
        return;
      }
      drawing.onDownPrv(e);
    },
    [panZoom, drawing],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (panZoom.panningRef.current) {
        panZoom.movePan(e);
        return;
      }
      drawing.onMovePrv(e);
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
      <div className="panel-layout">
        <div className="panel-canvas" style={{ "--display-max": displayW + "px" } as React.CSSProperties}>
          <div style={{ fontSize: FS.md, color: C.textDim, textAlign: "center", lineHeight: "14px" }}>
            {t("label_colorized")}
            <span style={{ marginLeft: SP.xl, color: C.textDimmest }}>
              {t("tool_" + tool)
                .replace(/[A-Za-z\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f]+/g, "")
                .trim()}
            </span>
          </div>
          <div
            ref={prvWrapRef}
            tabIndex={0}
            aria-label={t("aria_color_preview")}
            onKeyDown={handleKeyDown}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: R.lg,
              overflow: "hidden",
              position: "relative",
              width: displayW,
              height: displayH,
              ...S_CHECKERBOARD,
            }}
          >
            <canvas
              ref={prvRef}
              role="img"
              aria-label={t("aria_color_preview_canvas")}
              style={{ width: displayW, height: displayH, display: "block", ...canvasTransform, cursor: canvasCursor, touchAction: "none" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={drawing.onPointerLeavePrv}
              onContextMenu={handleContextMenu}
            />
            <canvas
              ref={prvCurRef}
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
        </div>
        <div className="panel-sidebar" style={{ marginTop: SP.xl }}>
          <ColorMappingList cc={cc} dispatch={ccDispatch} brushLevel={brushLevel} onSelectLevel={setBrushLevel} />
        </div>
      </div>
    </div>
  );
});
