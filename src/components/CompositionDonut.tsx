import React, { useMemo, useState, useCallback } from "react";
import { LEVEL_INFO, LEVEL_CANDIDATES, rgb2hue } from "../color-engine";
import { rgbStr, hexStr } from "../utils";
import { C, FS, SP, FONT } from "../styles/tokens";
import { S_CURSOR_POINTER } from "../styles/shared";
import { LEVEL_MASK } from "../constants";
import type { CanvasData } from "../types";
import { useTranslation } from "../i18n";

interface Slice {
  color: string;
  fraction: number;
  /** Tooltip lines shown on hover/tap */
  info: string[];
  /** Whether this slice represents a glaze change (used to control border rendering) */
  isGlazed?: boolean;
}

function computeSlices(entries: { count: number; color: string; info: string[]; isGlazed?: boolean }[], total: number): Slice[] {
  const slices: Slice[] = [];
  for (const v of entries) {
    if (v.count > 0) slices.push({ color: v.color, fraction: v.count / total, info: v.info, isGlazed: v.isGlazed ?? false });
  }
  return slices;
}

function drawRing(
  ringId: string,
  slices: Slice[],
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  onPreview: (info: string[] | null, color?: string) => void,
  onActivate: (sliceId: string, info: string[], color: string) => void,
): React.ReactNode[] {
  if (slices.length === 0) return [];
  const elems: React.ReactNode[] = [];
  let angle = -Math.PI / 2;

  for (let i = 0; i < slices.length; i++) {
    const s = slices[i];
    const sliceId = `${ringId}-${i}`;
    const sweep = s.fraction * Math.PI * 2;
    if (sweep < 0.001) continue;

    const handlers = {
      onMouseEnter: () => onPreview(s.info, s.color),
      onMouseLeave: () => onPreview(null),
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onActivate(sliceId, s.info, s.color);
      },
      style: S_CURSOR_POINTER,
    };

    if (s.fraction > 0.999) {
      elems.push(
        <React.Fragment key={sliceId}>
          <circle cx={cx} cy={cy} r={(rOuter + rInner) / 2} fill="none" stroke={s.color} strokeWidth={rOuter - rInner} {...handlers} />
        </React.Fragment>,
      );
      break;
    }

    const x1 = cx + rOuter * Math.cos(angle);
    const y1 = cy + rOuter * Math.sin(angle);
    const x2 = cx + rOuter * Math.cos(angle + sweep);
    const y2 = cy + rOuter * Math.sin(angle + sweep);
    const x3 = cx + rInner * Math.cos(angle + sweep);
    const y3 = cy + rInner * Math.sin(angle + sweep);
    const x4 = cx + rInner * Math.cos(angle);
    const y4 = cy + rInner * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;

    const d = `M${x1},${y1} A${rOuter},${rOuter} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${rInner},${rInner} 0 ${large} 0 ${x4},${y4} Z`;
    // Only show border on glazed slices
    const showBorder = s.isGlazed;
    elems.push(
      <React.Fragment key={sliceId}>
        <path d={d} fill={s.color} stroke={showBorder ? C.bgPanel : "none"} strokeWidth={showBorder ? 0.5 : 0} {...handlers} />
      </React.Fragment>,
    );
    angle += sweep;
  }
  return elems;
}

interface CompositionDonutProps {
  canvasData: CanvasData;
  levelHistogram: number[];
  total: number;
  colorLUT: [number, number, number][];
  candidateIndexByLevel: readonly number[];
}

export const CompositionDonut = React.memo(function CompositionDonut({
  canvasData,
  levelHistogram,
  total,
  colorLUT,
  candidateIndexByLevel,
}: CompositionDonutProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<{ info: string[]; color: string } | null>(null);
  const [selected, setSelected] = useState<{ id: string; info: string[]; color: string } | null>(null);

  const onPreview = useCallback((info: string[] | null, color?: string) => {
    setPreview(info && color ? { info, color } : null);
  }, []);

  const onActivate = useCallback((id: string, info: string[], color: string) => {
    setPreview(null);
    setSelected((current) => (current?.id === id ? null : { id, info, color }));
  }, []);

  const { graySlices, colorSlices, glazeSlices, hasGlaze } = useMemo(() => {
    const pct = (n: number) => ((n / Math.max(1, total)) * 100).toFixed(1);

    // === Layer 1: Gray ===
    const grayEntries: { count: number; color: string; info: string[] }[] = [];
    for (let lv = 0; lv < 8; lv++) {
      const g = LEVEL_INFO[lv].gray;
      grayEntries.push({
        count: levelHistogram[lv],
        color: `rgb(${g},${g},${g})`,
        info: [
          `L${lv} ${LEVEL_INFO[lv].name}`,
          t("donut_tone_value", g),
          t("donut_count_pct", pct(levelHistogram[lv]), levelHistogram[lv].toLocaleString()),
        ],
      });
    }

    // === Layer 2: Color ===
    const colorEntries: { count: number; color: string; info: string[] }[] = [];
    for (let lv = 0; lv < 8; lv++) {
      const rgb = colorLUT[lv];
      const alts = LEVEL_CANDIDATES[lv];
      const ci = lv < candidateIndexByLevel.length ? ((candidateIndexByLevel[lv] % alts.length) + alts.length) % alts.length : 0;
      const candidate = alts[ci];
      const hueLabel = candidate?.hueLabel ?? "—";
      colorEntries.push({
        count: levelHistogram[lv],
        color: rgbStr(rgb),
        info: [
          `L${lv} ${LEVEL_INFO[lv].name}`,
          `${hexStr(rgb)} (${t("donut_hue", hueLabel)})`,
          t("donut_candidate", ci + 1, alts.length),
          t("donut_count_pct", pct(levelHistogram[lv]), levelHistogram[lv].toLocaleString()),
        ],
      });
    }

    // === Layer 3: Glaze ===
    let hasGlazeOverride = false;
    const levelData = canvasData.levelData;
    const pixelCandidateOverrideMap = canvasData.pixelCandidateOverrideMap;
    const n = levelData.length;

    // Count per (level, actual color) group — merge default and glazed if same color
    interface GlazeGroup {
      count: number;
      rgb: readonly [number, number, number];
      isGlazed: boolean;
      lv: number;
    }
    const glazePerLevel: Map<string, GlazeGroup>[] = [];
    for (let lv = 0; lv < 8; lv++) glazePerLevel.push(new Map());

    for (let i = 0; i < n; i++) {
      const lv = levelData[i] & LEVEL_MASK;
      const pixelCandidateOverrideValue = pixelCandidateOverrideMap[i];
      let rgb: readonly [number, number, number];
      let isGlazed = false;
      if (pixelCandidateOverrideValue === 0) {
        rgb = colorLUT[lv];
      } else {
        hasGlazeOverride = true;
        const alts = LEVEL_CANDIDATES[lv];
        const ci = (((pixelCandidateOverrideValue - 1) % alts.length) + alts.length) % alts.length;
        rgb = alts[ci]?.rgb ?? colorLUT[lv];
        // Only mark as glazed if actual color differs from default
        const defRgb = colorLUT[lv];
        isGlazed = rgb[0] !== defRgb[0] || rgb[1] !== defRgb[1] || rgb[2] !== defRgb[2];
      }
      const key = rgbStr(rgb);
      const existing = glazePerLevel[lv].get(key);
      if (existing) {
        existing.count += 1;
        if (isGlazed) existing.isGlazed = true;
      } else {
        glazePerLevel[lv].set(key, { count: 1, rgb, isGlazed, lv });
      }
    }

    const glazeEntries: { count: number; color: string; info: string[]; isGlazed?: boolean }[] = [];
    for (let lv = 0; lv < 8; lv++) {
      // Check if this level has any glaze changes at all
      const levelHasGlaze = [...glazePerLevel[lv].values()].some((g) => g.isGlazed);
      const levelTotal = levelHistogram[lv];
      const levelPct = (n: number) => (levelTotal > 0 ? ((n / levelTotal) * 100).toFixed(1) : "0.0");
      for (const [, g] of glazePerLevel[lv]) {
        // Find candidate index of actual color (for L1-L6; L0/L7 have single candidate)
        const alts = LEVEL_CANDIDATES[lv];
        const candIdx = alts.findIndex((a) => a.rgb[0] === g.rgb[0] && a.rgb[1] === g.rgb[1] && a.rgb[2] === g.rgb[2]);
        const hasCandidate = lv >= 1 && lv <= 6 && alts.length > 1 && candIdx >= 0;
        const countLine = `${t("donut_count_pct", pct(g.count), g.count.toLocaleString())} · ${t("donut_level_pct", lv, levelPct(g.count))}`;

        // For levels with no glaze changes, draw with same color but no border
        if (!levelHasGlaze && !g.isGlazed) {
          const lines = [`L${lv} ${hexStr(g.rgb)}`];
          if (hasCandidate) lines.push(t("donut_candidate", candIdx + 1, alts.length));
          lines.push(countLine);
          glazeEntries.push({ count: g.count, color: rgbStr(g.rgb), info: lines, isGlazed: false });
          continue;
        }
        const defaultColor = hexStr(colorLUT[lv]);
        const actualColor = hexStr(g.rgb);
        const lines = [`L${lv} ${actualColor}`];
        if (hasCandidate) lines.push(t("donut_candidate", candIdx + 1, alts.length));
        if (g.isGlazed) {
          lines.push(t("donut_glaze_changed", defaultColor));
          // Hue delta vs default (shortest signed difference, -180..+180)
          if (lv >= 1 && lv <= 6) {
            const hueActual = rgb2hue(g.rgb[0], g.rgb[1], g.rgb[2]);
            const def = colorLUT[lv];
            const hueDef = rgb2hue(def[0], def[1], def[2]);
            let d = hueActual - hueDef;
            d = ((d + 540) % 360) - 180;
            lines.push(t("donut_hue_delta", (d >= 0 ? "+" : "") + d.toFixed(0)));
          }
        }
        lines.push(countLine);
        glazeEntries.push({ count: g.count, color: rgbStr(g.rgb), info: lines, isGlazed: g.isGlazed });
      }
    }

    return {
      graySlices: computeSlices(grayEntries, total),
      colorSlices: computeSlices(colorEntries, total),
      glazeSlices: computeSlices(glazeEntries, total),
      hasGlaze: hasGlazeOverride,
    };
  }, [canvasData.levelData, canvasData.pixelCandidateOverrideMap, levelHistogram, total, colorLUT, candidateIndexByLevel, t]);

  const size = 260;
  const cx = size / 2,
    cy = size / 2;

  const grayOuter = hasGlaze ? 42 : 50;
  const grayInner = hasGlaze ? 26 : 28;
  const colorOuter = hasGlaze ? 76 : 96;
  const colorInner = hasGlaze ? 47 : 54;
  const glazeOuter = 122;
  const glazeInner = 81;

  const activeInfo = preview ?? selected;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
      onClick={() => {
        setPreview(null);
        setSelected(null);
      }}
    >
      <div style={{ maxWidth: "min(260px, 90vw)", width: "100%" }}>
        <svg
          width="100%"
          height="auto"
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={t("map_composition")}
          style={{ display: "block", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          {drawRing("gray", graySlices, cx, cy, grayOuter, grayInner, onPreview, onActivate)}
          {drawRing("color", colorSlices, cx, cy, colorOuter, colorInner, onPreview, onActivate)}
          {hasGlaze && drawRing("glaze", glazeSlices, cx, cy, glazeOuter, glazeInner, onPreview, onActivate)}
          {activeInfo && <circle cx={cx} cy={cy} r={grayInner - 18} fill={activeInfo.color} stroke={C.border} strokeWidth={1} />}
        </svg>
      </div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 8, fontSize: FS.xs, color: C.textDimmer, marginTop: SP.lg }}>
        <span>{t("donut_layer_tone")}</span>
        <span>{t("donut_layer_color")}</span>
        {hasGlaze && <span>{t("donut_layer_glaze")}</span>}
      </div>
      {/* Info text — minHeight reserves space for the tallest tooltip (5 lines × 14.4px lineHeight) so hover doesn't shift layout */}
      <div
        style={{
          minHeight: 76,
          marginTop: SP.xl,
          padding: `${SP.lg}px ${SP.xl}px`,
          fontSize: FS.sm,
          fontFamily: FONT.mono,
          textAlign: "center",
          lineHeight: 1.6,
          visibility: activeInfo ? "visible" : "hidden",
        }}
      >
        {activeInfo?.info.map((line, i) => (
          <div key={i} style={{ color: i === 0 ? C.textPrimary : C.textDimmer }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
});
