import React from "react";
import { FANO_LINES } from "../theory/theory-data";
import { C, FS, FW } from "../../tokens";

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

// Fano plane points (equilateral triangle layout, same as XorFanoLine)
const PTS: Record<number, [number, number]> = {
  2: [90, 15],
  1: [17, 122],
  4: [163, 122],
  3: [53.5, 68.5],
  6: [126.5, 68.5],
  5: [90, 122],
  7: [90, 86.3],
};

// Inscribed circle for line 6 (CMY)
const TRI_CX = (PTS[3][0] + PTS[5][0] + PTS[6][0]) / 3;
const TRI_CY = (PTS[3][1] + PTS[5][1] + PTS[6][1]) / 3;
const CIRCLE_R = Math.sqrt((PTS[3][0] - TRI_CX) ** 2 + (PTS[3][1] - TRI_CY) ** 2);

// Line endpoints for rendering (line 6 = inscribed circle)
const LINE_ENDPOINTS: ([number, number] | null)[] = [
  [1, 2],
  [1, 4],
  [2, 4],
  [1, 6],
  [2, 5],
  [3, 4],
  null, // circle
];

function pointColor(lv: number, activeLevels: { lv: number; rgb: [number, number, number] }[]): string {
  const al = activeLevels.find((a) => a.lv === lv);
  return al ? `rgb(${al.rgb.join(",")})` : LV_COLORS[lv];
}

function linesThrough(p: number): number[] {
  return FANO_LINES.reduce<number[]>((acc, line, i) => {
    if (line.includes(p)) acc.push(i);
    return acc;
  }, []);
}

const W = 180,
  H = 155;
const DOT_R = 10;

interface Props {
  selectedPoint: number;
  activeLineIdx: number;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

export const PointFanoContext = React.memo(function PointFanoContext({ selectedPoint, activeLineIdx, activeLevels }: Props) {
  const throughLines = linesThrough(selectedPoint);
  const isThroughLine = (li: number) => throughLines.includes(li);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }}>
      <defs>
        <filter id="pf-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Lines */}
      {FANO_LINES.map((_, li) => {
        const isThrough = isThroughLine(li);
        const isActive = activeLineIdx === li;
        const ep = LINE_ENDPOINTS[li];
        if (!ep) {
          // Inscribed circle (line 6 = CMY)
          return (
            <circle
              key={"l" + li}
              cx={TRI_CX}
              cy={TRI_CY}
              r={CIRCLE_R}
              fill="none"
              stroke={isActive ? "#60ffa0" : C.textDimmer}
              strokeWidth={isActive ? 2 : isThrough ? 1.2 : 0.8}
              opacity={isActive ? 0.9 : isThrough ? 0.5 : 0.15}
            />
          );
        }
        const [a, b] = ep;
        return (
          <line
            key={"l" + li}
            x1={PTS[a][0]}
            y1={PTS[a][1]}
            x2={PTS[b][0]}
            y2={PTS[b][1]}
            stroke={isActive ? "#60ffa0" : C.textDimmer}
            strokeWidth={isActive ? 2.5 : isThrough ? 1.5 : 0.8}
            opacity={isActive ? 0.9 : isThrough ? 0.5 : 0.15}
          />
        );
      })}
      {/* Points */}
      {[1, 2, 3, 4, 5, 6, 7].map((lv) => {
        const [x, y] = PTS[lv];
        const isSelected = lv === selectedPoint;
        const isOnActiveLine = activeLineIdx >= 0 && FANO_LINES[activeLineIdx]?.includes(lv);
        return (
          <g key={lv} filter={isOnActiveLine ? "url(#pf-glow)" : undefined}>
            {isSelected && <circle cx={x} cy={y} r={DOT_R + 5} fill="none" stroke={C.accent} strokeWidth={2} opacity={0.7} />}
            <circle
              cx={x}
              cy={y}
              r={DOT_R}
              fill={pointColor(lv, activeLevels)}
              fillOpacity={isSelected || isOnActiveLine ? 0.9 : 0.4}
              stroke={isSelected ? "#fff" : LV_COLORS[lv]}
              strokeWidth={isSelected ? 2.5 : 1}
            />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={FS.sm}
              fontWeight={FW.bold}
              fontFamily="monospace"
              fill={lv >= 4 ? "#000" : "#fff"}
              opacity={isSelected || isOnActiveLine ? 1 : 0.5}
            >
              {lv}
            </text>
          </g>
        );
      })}
      {/* Active line equation */}
      {activeLineIdx >= 0 && activeLineIdx < FANO_LINES.length && (
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={8} fontFamily="monospace" fill="#60ffa0">
          {FANO_LINES[activeLineIdx].join(" \u2295 ")} = 0
        </text>
      )}
    </svg>
  );
});
