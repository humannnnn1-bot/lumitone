import React from "react";
import { C, R } from "../../tokens";

interface LineDualPartitionProps {
  phase: "line" | "dual" | null;
  lineIndex: number;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

const FANO_LINES = [
  [1, 2, 3],
  [1, 4, 5],
  [2, 4, 6],
  [1, 6, 7],
  [2, 5, 7],
  [3, 4, 7],
  [3, 5, 6],
];
const ALL_POINTS = [1, 2, 3, 4, 5, 6, 7];
const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

function pointColor(lv: number, activeLevels: LineDualPartitionProps["activeLevels"]): string {
  const found = activeLevels.find((l) => l.lv === lv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[lv] ?? "#888";
}

export const LineDualPartition = React.memo(function LineDualPartition({ phase, lineIndex, activeLevels }: LineDualPartitionProps) {
  const linePoints = FANO_LINES[lineIndex] ?? [1, 2, 3];
  const dualPoints = ALL_POINTS.filter((p) => !linePoints.includes(p));

  return (
    <svg width={180} height={100} viewBox="0 0 180 100" style={{ borderRadius: R.md, border: `1px solid ${C.border}` }}>
      <rect width={180} height={100} fill={C.bgPanel} rx={R.md} />

      {/* Bracket labels */}
      {phase === "line" && (
        <g>
          {/* Bracket above line points */}
          <text x={90} y={12} fontSize={8} fill={C.accent} textAnchor="middle">
            Line (3)
          </text>
        </g>
      )}
      {phase === "dual" && (
        <g>
          <text x={90} y={12} fontSize={8} fill={C.accent} textAnchor="middle">
            Line (3)
          </text>
          <text x={90} y={96} fontSize={8} fill={C.textDimmer} textAnchor="middle">
            Dual (4)
          </text>
        </g>
      )}

      {/* Points */}
      {ALL_POINTS.map((lv, i) => {
        const x = 15 + i * 23;
        const isLine = linePoints.includes(lv);
        const isDual = dualPoints.includes(lv);

        let y = 50;
        let bright = false;
        if (phase === "line" && isLine) {
          y = 25;
          bright = true;
        } else if (phase === "dual") {
          if (isLine) {
            y = 25;
            bright = true;
          }
          if (isDual) {
            y = 75;
            bright = true;
          }
        }

        const color = pointColor(lv, activeLevels);
        const opacity = phase === null ? 0.4 : bright ? 1 : 0.2;

        return (
          <g key={lv}>
            <circle cx={x} cy={y} r={8} fill={color} opacity={opacity} style={{ transition: "cy 0.3s ease, opacity 0.3s ease" }} />
            <text
              x={x}
              y={y + 3}
              fontSize={8}
              fill="#fff"
              textAnchor="middle"
              pointerEvents="none"
              opacity={opacity}
              style={{ transition: "y 0.3s ease, opacity 0.3s ease" }}
            >
              {lv}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
