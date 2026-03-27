import React, { useMemo, useState, useCallback } from "react";
import { LEVEL_INFO, LEVEL_CANDIDATES } from "../color-engine";
import { rgbStr, hexStr } from "../utils";
import { C, FS, SP } from "../tokens";
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
  slices: Slice[],
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  onSelect: (info: string[] | null, color?: string) => void,
): React.ReactNode[] {
  if (slices.length === 0) return [];
  const elems: React.ReactNode[] = [];
  let angle = -Math.PI / 2;

  for (let i = 0; i < slices.length; i++) {
    const s = slices[i];
    const sweep = s.fraction * Math.PI * 2;
    if (sweep < 0.001) continue;

    const handlers = {
      onMouseEnter: () => onSelect(s.info, s.color),
      onMouseLeave: () => onSelect(null),
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(s.info, s.color);
      },
      style: { cursor: "pointer" } as React.CSSProperties,
    };

    if (s.fraction > 0.999) {
      elems.push(
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={(rOuter + rInner) / 2}
          fill="none"
          stroke={s.color}
          strokeWidth={rOuter - rInner}
          {...handlers}
        />,
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
      <path key={i} d={d} fill={s.color} stroke={showBorder ? C.bgPanel : "none"} strokeWidth={showBorder ? 0.5 : 0} {...handlers} />,
    );
    angle += sweep;
  }
  return elems;
}

interface CompositionDonutProps {
  cvs: CanvasData;
  hist: number[];
  total: number;
  colorLUT: [number, number, number][];
  cc: number[];
}

export const CompositionDonut = React.memo(function CompositionDonut({ cvs, hist, total, colorLUT, cc }: CompositionDonutProps) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<{ info: string[]; color: string } | null>(null);

  const onSelect = useCallback((info: string[] | null, color?: string) => {
    setHover(info && color ? { info, color } : null);
  }, []);

  const { graySlices, colorSlices, glazeSlices, hasGlaze } = useMemo(() => {
    const pct = (n: number) => ((n / Math.max(1, total)) * 100).toFixed(1);

    // === Layer 1: Gray ===
    const grayEntries: { count: number; color: string; info: string[] }[] = [];
    for (let lv = 0; lv < 8; lv++) {
      const g = LEVEL_INFO[lv].gray;
      grayEntries.push({
        count: hist[lv],
        color: `rgb(${g},${g},${g})`,
        info: [`L${lv} ${LEVEL_INFO[lv].name}`, t("donut_tone_value", g), `${hist[lv].toLocaleString()} px (${pct(hist[lv])}%)`],
      });
    }

    // === Layer 2: Color ===
    const colorEntries: { count: number; color: string; info: string[] }[] = [];
    for (let lv = 0; lv < 8; lv++) {
      const rgb = colorLUT[lv];
      const alts = LEVEL_CANDIDATES[lv];
      const ci = lv < cc.length ? ((cc[lv] % alts.length) + alts.length) % alts.length : 0;
      const candidate = alts[ci];
      const hueLabel = candidate?.hueLabel ?? "—";
      colorEntries.push({
        count: hist[lv],
        color: rgbStr(rgb),
        info: [
          `L${lv} ${LEVEL_INFO[lv].name}`,
          `${hexStr(rgb)} (${t("donut_hue", hueLabel)})`,
          t("donut_candidate", ci + 1, alts.length),
          `${hist[lv].toLocaleString()} px (${pct(hist[lv])}%)`,
        ],
      });
    }

    // === Layer 3: Glaze ===
    let hasGlazeOverride = false;
    const data = cvs.data;
    const colorMap = cvs.colorMap;
    const n = data.length;

    // Count per (level, actual color) group — merge default and glazed if same color
    interface GlazeGroup {
      count: number;
      rgb: [number, number, number];
      isGlazed: boolean;
      lv: number;
    }
    const glazePerLevel: Map<string, GlazeGroup>[] = [];
    for (let lv = 0; lv < 8; lv++) glazePerLevel.push(new Map());

    for (let i = 0; i < n; i++) {
      const lv = data[i] & LEVEL_MASK;
      const cm = colorMap[i];
      let rgb: [number, number, number];
      let isGlazed = false;
      if (cm === 0) {
        rgb = colorLUT[lv];
      } else {
        hasGlazeOverride = true;
        const alts = LEVEL_CANDIDATES[lv];
        const ci = (((cm - 1) % alts.length) + alts.length) % alts.length;
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
      for (const [, g] of glazePerLevel[lv]) {
        // For levels with no glaze changes, draw with same color but no border
        if (!levelHasGlaze && !g.isGlazed) {
          glazeEntries.push({
            count: g.count,
            color: rgbStr(g.rgb),
            info: [`L${lv} ${hexStr(g.rgb)}`, `${g.count.toLocaleString()} px (${pct(g.count)}%)`],
            isGlazed: false,
          });
          continue;
        }
        const defaultColor = hexStr(colorLUT[lv]);
        const actualColor = hexStr(g.rgb);
        const lines = [`L${lv} ${actualColor}`];
        if (g.isGlazed) {
          lines.push(t("donut_glaze_changed", defaultColor));
        }
        lines.push(`${g.count.toLocaleString()} px (${pct(g.count)}%)`);
        glazeEntries.push({ count: g.count, color: rgbStr(g.rgb), info: lines, isGlazed: g.isGlazed });
      }
    }

    return {
      graySlices: computeSlices(grayEntries, total),
      colorSlices: computeSlices(colorEntries, total),
      glazeSlices: computeSlices(glazeEntries, total),
      hasGlaze: hasGlazeOverride,
    };
  }, [cvs.data, cvs.colorMap, hist, total, colorLUT, cc, t]);

  const size = 260;
  const cx = size / 2,
    cy = size / 2;

  const grayOuter = hasGlaze ? 42 : 50;
  const grayInner = hasGlaze ? 26 : 28;
  const colorOuter = hasGlaze ? 76 : 96;
  const colorInner = hasGlaze ? 47 : 54;
  const glazeOuter = 122;
  const glazeInner = 81;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }} onClick={() => setHover(null)}>
      <div style={{ maxWidth: "min(260px, 90vw)", width: "100%" }}>
        <svg width="100%" height="auto" viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
          {drawRing(graySlices, cx, cy, grayOuter, grayInner, onSelect)}
          {drawRing(colorSlices, cx, cy, colorOuter, colorInner, onSelect)}
          {hasGlaze && drawRing(glazeSlices, cx, cy, glazeOuter, glazeInner, onSelect)}
          {hover && <circle cx={cx} cy={cy} r={grayInner - 18} fill={hover.color} stroke={C.border} strokeWidth={1} />}
        </svg>
      </div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 8, fontSize: FS.xs, color: C.textDimmer, marginTop: SP.lg }}>
        <span>{t("donut_layer_tone")}</span>
        <span>{t("donut_layer_color")}</span>
        {hasGlaze && <span>{t("donut_layer_glaze")}</span>}
      </div>
      {/* Info text */}
      <div
        style={{
          height: 56,
          overflow: "hidden",
          marginTop: SP.xl,
          padding: `${SP.lg}px ${SP.xl}px`,
          fontSize: FS.sm,
          fontFamily: "monospace",
          textAlign: "center",
          lineHeight: 1.6,
          visibility: hover ? "visible" : "hidden",
        }}
      >
        {hover?.info.map((line, i) => (
          <div key={i} style={{ color: i === 0 ? C.textPrimary : C.textDimmer }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
});
