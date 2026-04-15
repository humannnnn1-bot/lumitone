import React from "react";
import { C } from "../../tokens";

interface ParityGridProps {
  activeGroups: (0 | 1 | 2)[];
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

const PARITY_GROUPS = [
  [1, 3, 5, 7],
  [2, 3, 6, 7],
  [4, 5, 6, 7],
];

const ROW_LABELS = ["P1", "P2", "P4"];
const ROW_COLORS = ["#0000ff", "#ff0000", "#00ff00"];

const CELL = 20;
const GAP = 2;
const LABEL_W = 24;
const HEADER_H = 14;
const LEFT = LABEL_W + 4;
const TOP = HEADER_H + 4;

function pointColor(lv: number, activeLevels: ParityGridProps["activeLevels"]): string {
  const found = activeLevels.find((l) => l.lv === lv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[lv] ?? "#888";
}

export const ParityGrid = React.memo(function ParityGrid({ activeGroups, activeLevels }: ParityGridProps) {
  return (
    <svg viewBox="-4 0 188 90" style={{ width: "100%", aspectRatio: "2" }}>
      <defs>
        <filter id="pg-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <style>{`
        @keyframes pg-pulse {
          0% { opacity: 0.7; }
          50% { opacity: 1; }
          100% { opacity: 0.7; }
        }
        .pg-active { animation: pg-pulse 0.6s ease-in-out infinite; }
      `}</style>

      {/* Column headers */}
      {[1, 2, 3, 4, 5, 6, 7].map((col) => (
        <text key={col} x={LEFT + (col - 1) * (CELL + GAP) + CELL / 2} y={HEADER_H} fontSize={8} fill={C.textDimmer} textAnchor="middle">
          {col}
        </text>
      ))}

      {/* Rows */}
      {PARITY_GROUPS.map((group, row) => {
        const y = TOP + row * (CELL + GAP);
        const isActive = activeGroups.includes(row as 0 | 1 | 2);

        return (
          <g key={row}>
            {/* Row label */}
            <text x={LABEL_W} y={y + CELL / 2 + 3} fontSize={8} fill={ROW_COLORS[row]} textAnchor="end" fontWeight={isActive ? 700 : 400}>
              {ROW_LABELS[row]}
            </text>

            {/* Cells */}
            {[1, 2, 3, 4, 5, 6, 7].map((col) => {
              const x = LEFT + (col - 1) * (CELL + GAP);
              const isMember = group.includes(col);
              const col_ = pointColor(col, activeLevels);
              const isGlow = isActive && isMember;

              return (
                <g key={col} filter={isGlow ? "url(#pg-glow)" : undefined}>
                  <rect
                    className={isGlow ? "pg-active" : undefined}
                    x={x}
                    y={y}
                    width={CELL}
                    height={CELL}
                    rx={2}
                    fill={isMember ? col_ : "transparent"}
                    fillOpacity={isMember ? (isGlow ? 1 : 0.6) : 0}
                    stroke={isMember ? col_ : C.border}
                    strokeWidth={1}
                    strokeOpacity={isMember ? 0.8 : 0.3}
                  />
                  {isMember && (
                    <text x={x + CELL / 2} y={y + CELL / 2 + 3} fontSize={7} fill="#fff" textAnchor="middle" pointerEvents="none">
                      {col}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
});
