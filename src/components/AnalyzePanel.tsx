import React from "react";
import { useTranslation } from "../i18n";
import type { CanvasData, MapMode } from "../types";
import { S_BTN, S_BTN_ACTIVE, S_PANEL_SUBTITLE } from "../styles/shared";
import { MapCanvas } from "./MapCanvas";
import { usePixelMaps } from "../hooks/usePixelMaps";
import { CompositionDonut } from "./CompositionDonut";
import { C, SP, FS, FW } from "../styles/tokens";
import { getCanvasPanelClassName, getCanvasPanelStyle, getPanelLayoutClassName } from "../utils/panel-layout";

interface AnalyzePanelProps {
  levelHistogram: number[];
  total: number;
  colorLUT: [number, number, number][];
  candidateIndexByLevel: readonly number[];
  brushLevel: number;
  setBrushLevel: (lv: number) => void;
  canvasData: CanvasData;
  displayWidth: number;
  displayHeight: number;
  active: boolean;
  mapMode: MapMode;
  setMapMode: (mode: MapMode) => void;
  showToast?: (message: string, type: "error" | "success" | "info") => void;
}

/* ── Section title ── */
function ST({ title }: { title: string }) {
  return (
    <div style={{ borderTop: `1px solid ${C.bgSurface}`, marginTop: SP.sm, paddingTop: SP.xs, textAlign: "center" }}>
      <span style={{ fontSize: FS.xs, color: C.textDim, fontWeight: FW.bold, letterSpacing: 1, textTransform: "uppercase" }}>{title}</span>
    </div>
  );
}

const S_MAP_MODE_BTN: React.CSSProperties = {
  boxSizing: "border-box",
  height: 22,
  padding: `0 ${SP.md}px`,
  fontSize: FS.lg,
  fontWeight: FW.normal,
  lineHeight: "12px",
  whiteSpace: "nowrap",
};

/* ── Main AnalyzePanel ── */
export const AnalyzePanel = React.memo(
  function AnalyzePanel({
    levelHistogram,
    total,
    colorLUT,
    candidateIndexByLevel,
    brushLevel: _brushLevel,
    setBrushLevel: _setBrushLevel,
    canvasData,
    displayWidth,
    displayHeight,
    active,
    mapMode,
    setMapMode,
    showToast,
  }: AnalyzePanelProps) {
    const { t } = useTranslation();
    const pixelMaps = usePixelMaps(canvasData, mapMode, active);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: SP.lg, alignItems: "center" }}>
        <div style={S_PANEL_SUBTITLE}>{t("map_title")}</div>
        <div className={getPanelLayoutClassName(displayWidth, displayHeight)}>
          <div
            className={`${getCanvasPanelClassName(displayWidth, displayHeight)} panel-canvas--map`}
            style={getCanvasPanelStyle(displayWidth, displayHeight)}
          >
            <MapCanvas
              mode={mapMode}
              pixelMaps={pixelMaps}
              colorLUT={colorLUT}
              candidateIndexByLevel={candidateIndexByLevel}
              canvasData={canvasData}
              displayWidth={displayWidth}
              displayHeight={displayHeight}
              {...(showToast ? { showToast } : {})}
            />
            <div className="map-mode-buttons" style={{ display: "flex", gap: SP.xs, justifyContent: "center", marginTop: SP.xs }}>
              {(["levelTone", "colorLuma", "gradient"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMapMode(m)}
                  style={{
                    ...(mapMode === m ? S_BTN_ACTIVE : S_BTN),
                    ...S_MAP_MODE_BTN,
                  }}
                >
                  {t("map_map_" + m)}
                </button>
              ))}
              <span className="map-mode-break" />
              {(["region", "boundaryDistance", "isolation", "diversity"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMapMode(m)}
                  style={{
                    ...(mapMode === m ? S_BTN_ACTIVE : S_BTN),
                    ...S_MAP_MODE_BTN,
                  }}
                >
                  {t("map_map_" + m)}
                </button>
              ))}
            </div>
          </div>
          <div className="panel-sidebar">
            <ST title={t("map_composition")} />
            <div style={{ marginTop: -4 }}>
              <CompositionDonut
                canvasData={canvasData}
                levelHistogram={levelHistogram}
                total={total}
                colorLUT={colorLUT}
                candidateIndexByLevel={candidateIndexByLevel}
              />
            </div>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    if (prev.mapMode !== next.mapMode) return false;
    if (prev.total !== next.total || prev.brushLevel !== next.brushLevel) return false;
    if (prev.canvasData !== next.canvasData) return false;
    if (prev.candidateIndexByLevel !== next.candidateIndexByLevel) return false;
    if (prev.active !== next.active) return false;
    if (prev.displayWidth !== next.displayWidth || prev.displayHeight !== next.displayHeight) return false;
    for (let i = 0; i < 8; i++) {
      if (prev.levelHistogram[i] !== next.levelHistogram[i]) return false;
      const prevColor = prev.colorLUT[i],
        nextColor = next.colorLUT[i];
      if (prevColor[0] !== nextColor[0] || prevColor[1] !== nextColor[1] || prevColor[2] !== nextColor[2]) return false;
    }
    return true;
  },
);
