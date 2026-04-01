import React from "react";
import { useTranslation } from "../i18n";
import type { CanvasData } from "../types";
import { S_BTN, S_BTN_ACTIVE } from "../styles";
import { MapCanvas, usePixelMaps } from "./MapCanvas";
import { CompositionDonut } from "./CompositionDonut";
import { C, SP, FS, FW } from "../tokens";

export type MapMode = "entropy" | "noise" | "depth" | "gradient" | "region" | "luminance" | "colorlum";

interface AnalyzePanelProps {
  hist: number[];
  total: number;
  colorLUT: [number, number, number][];
  cc: number[];
  brushLevel: number;
  setBrushLevel: (lv: number) => void;
  cvs: CanvasData;
  displayW: number;
  displayH: number;
  mapMode: MapMode;
  setMapMode: (mode: MapMode) => void;
}

/* ── Section title ── */
function ST({ title }: { title: string }) {
  return (
    <div style={{ borderTop: `1px solid ${C.bgSurface}`, marginTop: SP.sm, paddingTop: SP.xs, textAlign: "center" }}>
      <span style={{ fontSize: FS.xs, color: C.textDim, fontWeight: FW.bold, letterSpacing: 1, textTransform: "uppercase" }}>{title}</span>
    </div>
  );
}

/* ── Main AnalyzePanel ── */
export const AnalyzePanel = React.memo(
  function AnalyzePanel({
    hist,
    total,
    colorLUT,
    cc,
    brushLevel: _brushLevel,
    setBrushLevel: _setBrushLevel,
    cvs,
    displayW,
    displayH,
    mapMode,
    setMapMode,
  }: AnalyzePanelProps) {
    const { t } = useTranslation();
    const pixelMaps = usePixelMaps(cvs, mapMode);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: SP.lg, alignItems: "center" }}>
        <div className="panel-layout">
          <div className="panel-canvas" style={{ "--display-max": displayW + "px" } as React.CSSProperties}>
            <div style={{ fontSize: FS.md, color: C.textDim, textAlign: "center", lineHeight: "14px" }}>{t("stats_title")}</div>
            <MapCanvas mode={mapMode} pixelMaps={pixelMaps} colorLUT={colorLUT} cvs={cvs} displayW={displayW} displayH={displayH} />
            <div
              className="map-mode-buttons"
              style={{ display: "flex", flexWrap: "wrap", gap: SP.xs, justifyContent: "center", marginTop: SP.xs }}
            >
              {(["luminance", "colorlum", "region", "gradient"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMapMode(m)}
                  style={{
                    ...(mapMode === m ? S_BTN_ACTIVE : S_BTN),
                    padding: `${SP.xs}px ${SP.md}px`,
                    fontSize: FS.md,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("stats_map_" + m)}
                </button>
              ))}
              <span className="map-mode-break" />
              {(["depth", "noise", "entropy"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMapMode(m)}
                  style={{
                    ...(mapMode === m ? S_BTN_ACTIVE : S_BTN),
                    padding: `${SP.xs}px ${SP.md}px`,
                    fontSize: FS.md,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("stats_map_" + m)}
                </button>
              ))}
            </div>
          </div>
          <div className="panel-sidebar">
            <ST title={t("stats_composition")} />
            <div style={{ marginTop: -4 }}>
              <CompositionDonut cvs={cvs} hist={hist} total={total} colorLUT={colorLUT} cc={cc} />
            </div>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    if (prev.mapMode !== next.mapMode) return false;
    if (prev.total !== next.total || prev.brushLevel !== next.brushLevel) return false;
    if (prev.cvs !== next.cvs) return false;
    if (prev.cc !== next.cc) return false;
    if (prev.displayW !== next.displayW || prev.displayH !== next.displayH) return false;
    for (let i = 0; i < 8; i++) {
      if (prev.hist[i] !== next.hist[i]) return false;
      const pc = prev.colorLUT[i],
        nc = next.colorLUT[i];
      if (pc[0] !== nc[0] || pc[1] !== nc[1] || pc[2] !== nc[2]) return false;
    }
    return true;
  },
);
