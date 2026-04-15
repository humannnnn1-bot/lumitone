import React from "react";
import { C, FS, FW } from "../../tokens";

export type HammingMode = "743" | "844";

interface WeightHistogramProps {
  mode: HammingMode;
  currentWeight: number;
  currentIndex: number;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

// [7,4,3]: weights 0,3,4,7 — counts [1,7,7,1]
const WEIGHTS_743 = [0, 3, 4, 7] as const;
const COUNTS_743: Record<number, number> = { 0: 1, 3: 7, 4: 7, 7: 1 };
// [8,4,4]: weights 0,4,8 — counts [1,14,1]
const WEIGHTS_844 = [0, 4, 8] as const;
const COUNTS_844: Record<number, number> = { 0: 1, 4: 14, 8: 1 };

const MAX_COUNT = 14;
const CELL_H = 5;
const MAX_H = MAX_COUNT * CELL_H;
const BAR_W = 28;
const TOP = 20;
const BOTTOM = TOP + MAX_H + 4;
const W = 180;

export const WeightHistogram = React.memo(function WeightHistogram({ mode, currentWeight, currentIndex }: WeightHistogramProps) {
  const weights = mode === "743" ? WEIGHTS_743 : WEIGHTS_844;
  const counts = mode === "743" ? COUNTS_743 : COUNTS_844;
  const barCount = weights.length;
  const totalW = barCount * BAR_W + (barCount - 1) * 12;
  const left = (W - totalW) / 2;

  return (
    <svg viewBox={`4 0 ${W - 8} 100`} style={{ width: "100%" }}>
      <defs>
        <filter id="wh-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Mode title */}
      <text x={W / 2} y={12} textAnchor="middle" fontSize={FS.xs} fontFamily="monospace" fontWeight={FW.bold} fill={C.textMuted}>
        [{mode === "743" ? "7,4,3" : "8,4,4"}]
      </text>

      {weights.map((w, i) => {
        const count = counts[w];
        const x = left + i * (BAR_W + 12);
        const isActiveWeight = currentWeight === w;

        return (
          <g key={w}>
            {/* Stacked cells */}
            {Array.from({ length: count }, (_, ci) => {
              const cellY = BOTTOM - (ci + 1) * CELL_H;
              // Determine if this specific cell is the active one
              let isActiveCell = false;
              if (isActiveWeight) {
                if (count === 1) {
                  isActiveCell = true;
                } else if (mode === "743") {
                  // w=3: indices 1-7, w=4: indices 8-14
                  isActiveCell =
                    w === 3
                      ? currentIndex >= 1 && currentIndex <= 7 && ci === currentIndex - 1
                      : currentIndex >= 8 && currentIndex <= 14 && ci === currentIndex - 8;
                } else {
                  // [8,4,4] w=4: indices 1-14
                  isActiveCell = currentIndex >= 1 && currentIndex <= 14 && ci === currentIndex - 1;
                }
              }
              const color = mode === "743" ? C.accent : ci < 7 ? "#6080ff" : "#60ffa0";
              return (
                <rect
                  key={ci}
                  x={x}
                  y={cellY}
                  width={BAR_W}
                  height={CELL_H - 1}
                  rx={1}
                  fill={color}
                  fillOpacity={isActiveCell ? 0.9 : 0.2}
                  stroke={isActiveCell ? "#fff" : "transparent"}
                  strokeWidth={isActiveCell ? 1 : 0}
                  filter={isActiveCell ? "url(#wh-glow)" : undefined}
                />
              );
            })}
            {/* Count above */}
            <text
              x={x + BAR_W / 2}
              y={BOTTOM - count * CELL_H - 3}
              fontSize={7}
              fill={C.textDimmer}
              textAnchor="middle"
              fontFamily="monospace"
            >
              {count}
            </text>
            {/* Weight below */}
            <text x={x + BAR_W / 2} y={BOTTOM + 10} fontSize={7} fill={C.textDimmer} textAnchor="middle" fontFamily="monospace">
              w={w}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
