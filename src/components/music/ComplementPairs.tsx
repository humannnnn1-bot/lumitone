import React from "react";
import { C, FS } from "../../tokens";
import { COMPLEMENT_PAIRS, LUMA_VALUES } from "./music-data";

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];
const W = 180,
  H = 100;
const CX = W / 2;
const BAR_H = 14,
  ROW_GAP = 6,
  TOP = 18;
const MAX_BAR = 70; // max bar width for luma 226

function pointColor(lv: number, activeLevels: { lv: number; rgb: [number, number, number] }[]): string {
  const al = activeLevels.find((a) => a.lv === lv);
  return al ? `rgb(${al.rgb.join(",")})` : LV_COLORS[lv];
}

interface Props {
  activePair: number;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

export const ComplementPairs = React.memo(function ComplementPairs({ activePair, activeLevels }: Props) {
  return (
    <svg viewBox={`8 0 ${W - 16} ${H}`} style={{ width: "100%" }}>
      <defs>
        <filter id="cp-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Center line: 127.5 → 550Hz constant */}
      <line
        x1={CX}
        y1={TOP - 4}
        x2={CX}
        y2={TOP + 3 * (BAR_H + ROW_GAP)}
        stroke={C.accent}
        strokeWidth={1}
        strokeDasharray="3,2"
        opacity={0.6}
      />
      <text x={CX} y={TOP - 6} textAnchor="middle" fontSize={7} fontFamily="monospace" fill={C.accent} opacity={0.8}>
        550Hz
      </text>
      {COMPLEMENT_PAIRS.map(([a, b], i) => {
        const y = TOP + i * (BAR_H + ROW_GAP);
        const wA = (LUMA_VALUES[a] / 255) * MAX_BAR;
        const wB = (LUMA_VALUES[b] / 255) * MAX_BAR;
        const isActive = activePair === i;
        return (
          <g key={i} filter={isActive ? "url(#cp-glow)" : undefined} opacity={activePair >= 0 && !isActive ? 0.25 : 1}>
            {/* Left bar (lower luma) */}
            <rect x={CX - wA} y={y} width={wA} height={BAR_H} rx={2} fill={pointColor(a, activeLevels)} fillOpacity={0.8} />
            {/* Right bar (higher luma) */}
            <rect x={CX} y={y} width={wB} height={BAR_H} rx={2} fill={pointColor(b, activeLevels)} fillOpacity={0.8} />
            {/* Labels */}
            <text
              x={CX - wA - 4}
              y={y + BAR_H / 2}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={FS.xxs}
              fontFamily="monospace"
              fill={LV_COLORS[a]}
            >
              {a}
            </text>
            <text
              x={CX + wB + 4}
              y={y + BAR_H / 2}
              textAnchor="start"
              dominantBaseline="central"
              fontSize={FS.xxs}
              fontFamily="monospace"
              fill={LV_COLORS[b]}
            >
              {b}
            </text>
            {/* Sum label */}
            {isActive && (
              <text
                x={W - 4}
                y={y + BAR_H / 2}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={7}
                fontFamily="monospace"
                fill={C.textMuted}
              >
                {LUMA_VALUES[a]}+{LUMA_VALUES[b]}=255
              </text>
            )}
          </g>
        );
      })}
      {/* Theorem label */}
      <text x={CX} y={H - 4} textAnchor="middle" fontSize={7} fontFamily="monospace" fill={C.textDimmer}>
        Y&#x2096; + Y&#x2087;&#x208b;&#x2096; = 255
      </text>
    </svg>
  );
});
