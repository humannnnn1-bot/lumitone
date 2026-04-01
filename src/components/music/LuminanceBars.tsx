import React from "react";
import { C, R } from "../../tokens";

interface LuminanceBarsProps {
  mode: "symmetric" | "luminance";
  activeLevels: { lv: number; rgb: [number, number, number] }[];
  flash?: boolean; // true for ~600ms after mode switch
}

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

// BT.601 luminance per level (levels 1-6)
const BT601: Record<number, number> = {
  1: 0.114, // B
  2: 0.299, // R
  3: 0.413, // M
  4: 0.587, // G
  5: 0.701, // C
  6: 0.886, // Y
};
const BT601_MAX = 0.886;

const LEVELS = [1, 2, 3, 4, 5, 6];
const BAR_W = 20;
const BAR_GAP = 5;
const MAX_H = 60;
const LEFT = 15;
const TOP = 20;

function lvColor(lv: number, activeLevels: LuminanceBarsProps["activeLevels"]): string {
  const found = activeLevels.find((l) => l.lv === lv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[lv] ?? "#888";
}

export const LuminanceBars = React.memo(function LuminanceBars({ mode, activeLevels, flash }: LuminanceBarsProps) {
  return (
    <svg
      viewBox="0 0 180 90"
      style={{ width: "100%", maxWidth: 180, aspectRatio: "2", borderRadius: R.md, border: `1px solid ${C.border}` }}
    >
      <rect width={180} height={90} fill={C.bgPanel} rx={R.md} />

      <defs>
        <filter id="lb-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Mode label */}
      <text x={90} y={12} fontSize={8} fill={C.accent} textAnchor="middle" fontWeight={flash ? 700 : 400}>
        {mode === "symmetric" ? "Equal" : "BT.601"}
      </text>

      {LEVELS.map((lv, i) => {
        const x = LEFT + i * (BAR_W + BAR_GAP);
        const color = lvColor(lv, activeLevels);

        const h = mode === "symmetric" ? MAX_H : (BT601[lv] / BT601_MAX) * MAX_H;

        const y = TOP + MAX_H - h;

        return (
          <g key={lv} filter={flash ? "url(#lb-glow)" : undefined}>
            <rect
              x={x}
              y={y}
              width={BAR_W}
              height={h}
              rx={2}
              fill={color}
              opacity={flash ? 1 : 0.8}
              stroke={flash ? "#fff" : "none"}
              strokeWidth={flash ? 1 : 0}
              style={{ transition: "y 0.3s ease, height 0.3s ease, opacity 0.3s ease" }}
            />
            {/* Level label below */}
            <text x={x + BAR_W / 2} y={TOP + MAX_H + 12} fontSize={8} fill={C.textDimmer} textAnchor="middle">
              {lv}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
