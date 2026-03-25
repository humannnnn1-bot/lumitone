import React from "react";
import { LEVEL_INFO } from "../color-engine";
import { rgbStr } from "../utils";
import { useTranslation } from "../i18n";
import type { CanvasData } from "../types";
import { S_BTN, S_BTN_ACTIVE } from "../styles";
import { MapCanvas, usePixelMaps } from "./MapCanvas";
import { C, SP, FS, FW, R } from "../tokens";

export type MapMode = "entropy" | "noise" | "depth" | "gradient" | "region" | "luminance" | "colorlum";

interface StatsPanelProps {
  hist: number[];
  total: number;
  colorLUT: [number, number, number][];
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
    <div style={{ borderTop: `1px solid ${C.bgSurface}`, marginTop: SP.sm, paddingTop: SP.xs }}>
      <span style={{ fontSize: FS.xs, color: C.textDim, fontWeight: FW.bold, letterSpacing: 1, textTransform: "uppercase" }}>{title}</span>
    </div>
  );
}

/* ── Main StatsPanel ── */
export const StatsPanel = React.memo(function StatsPanel({
  hist, total, colorLUT, brushLevel, setBrushLevel, cvs, displayW, displayH, mapMode, setMapMode,
}: StatsPanelProps) {
  const { t } = useTranslation();
  const maxCount = Math.max(1, ...hist);
  const usedLevels = hist.filter(c => c > 0).length;
  const pixelMaps = usePixelMaps(cvs, mapMode);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.xs, alignItems: "center", width: displayW }}>
      <div style={{ fontSize: FS.md, color: C.textDim, minHeight: 14 }}>{t("stats_title")}</div>

      {/* ── Map section (top) ── */}
      <MapCanvas mode={mapMode} pixelMaps={pixelMaps}
        colorLUT={colorLUT} cvs={cvs} displayW={displayW} displayH={displayH} />
      <div style={{ display: "flex", gap: SP.xs, justifyContent: "center", marginTop: SP.xs }}>
        {(["entropy", "gradient", "depth", "noise", "luminance", "colorlum", "region"] as const).map(m => (
          <button key={m} onClick={() => setMapMode(m)}
            style={{ ...(mapMode === m ? S_BTN_ACTIVE : S_BTN), padding: `${SP.xs}px ${SP.xl}px`, fontSize: FS.sm }}>
            {t("stats_map_" + m)}
          </button>
        ))}
      </div>

      {/* ── Composition ── */}
      <ST title={t("stats_composition")} />
      <div style={{ display: "flex", height: 18, borderRadius: R.md, overflow: "hidden", border: `1px solid ${C.bgSurface}`, width: "100%" }}>
        {hist.map((count, lv) => count > 0 ? (
          <div key={lv} onClick={() => setBrushLevel(lv)}
            style={{ flexGrow: count, background: rgbStr(colorLUT[lv]), cursor: "pointer", minWidth: 2,
              borderRight: lv < 7 && hist[lv + 1] > 0 ? `1px solid ${C.bgRoot}` : "none" }}
            title={t("stats_level_tooltip", lv, LEVEL_INFO[lv].name, count.toLocaleString(), (count / total * 100).toFixed(1))}
          />
        ) : null)}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: SP.xs, width: "100%" }}>
        {LEVEL_INFO.map((info, lv) => {
          const count = hist[lv];
          const pct = total > 0 ? (count / total * 100) : 0;
          const barPct = maxCount > 0 ? (count / maxCount * 100) : 0;
          const unused = count === 0;
          const selected = brushLevel === lv;
          const g = info.gray;
          return (
            <div key={lv} onClick={() => setBrushLevel(lv)} role="button" tabIndex={0}
              aria-label={t("stats_level", lv, info.name)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setBrushLevel(lv); } }}
              style={{
                display: "flex", alignItems: "center", gap: SP.lg, padding: `${SP.sm}px ${SP.lg}px`,
                borderRadius: R.md, cursor: "pointer",
                border: selected ? `1px solid ${C.accent}` : "1px solid transparent",
                background: selected ? C.activeBg : "transparent",
              }}>
              <div style={{ width: 18, height: 18, borderRadius: R.md, flexShrink: 0,
                background: `rgb(${g},${g},${g})`, border: `1px solid ${C.border}` }} />
              <span style={{ fontSize: FS.md, color: C.textDim, width: 22, flexShrink: 0, fontFamily: "monospace" }}>L{lv}</span>
              <div style={{ flex: 1, minWidth: 0, height: 14, background: C.bgInput, borderRadius: R.sm, overflow: "hidden", border: `1px solid ${C.bgSurface}` }}>
                {barPct > 0 && <div style={{ width: `${Math.max(0.5, barPct)}%`, height: "100%", background: rgbStr(colorLUT[lv]), borderRadius: R.sm }} />}
              </div>
              {unused ? (
                <svg width={14} height={14} style={{ flexShrink: 0 }}>
                  <rect width={14} height={14} rx={R.md} fill={C.bgInput} stroke={C.border} strokeWidth={1} />
                  <line x1={3} y1={11} x2={11} y2={3} stroke={C.borderHover} strokeWidth={1} />
                </svg>
              ) : (
                <div style={{ width: 14, height: 14, borderRadius: R.md, flexShrink: 0, background: rgbStr(colorLUT[lv]), border: `1px solid ${C.border}` }} />
              )}
              <span style={{ fontSize: FS.sm, color: C.textDimmer, fontFamily: "monospace", width: 100, flexShrink: 0, textAlign: "right" }}>
                {unused ? t("stats_unused") : `${count.toLocaleString()} (${pct.toFixed(1)}%)`}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: FS.sm, color: C.textSubtle, textAlign: "center", fontFamily: "monospace", marginTop: SP.xs }}>
        {t("stats_used_levels", usedLevels)} · {t("stats_total_pixels", total.toLocaleString())}
      </div>
    </div>
  );
}, (prev, next) => {
  if (prev.mapMode !== next.mapMode) return false;
  if (prev.total !== next.total || prev.brushLevel !== next.brushLevel) return false;
  if (prev.cvs !== next.cvs) return false;
  if (prev.displayW !== next.displayW || prev.displayH !== next.displayH) return false;
  for (let i = 0; i < 8; i++) {
    if (prev.hist[i] !== next.hist[i]) return false;
    const pc = prev.colorLUT[i], nc = next.colorLUT[i];
    if (pc[0] !== nc[0] || pc[1] !== nc[1] || pc[2] !== nc[2]) return false;
  }
  return true;
});
