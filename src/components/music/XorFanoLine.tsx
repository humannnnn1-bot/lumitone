import React from "react";
import { C } from "../../tokens";
import { FANO_LINES } from "../theory/theory-data";

interface XorFanoLineProps {
  stepLv: number | null;
  lvA: number | null;
  lvB: number | null;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

// Projective duality: each line's dual point in GF(2)³
const LINE_DUAL_POINTS = [4, 2, 1, 6, 5, 3, 7];

// Standard Fano plane layout: equilateral triangle + midpoints + centroid
// Matching MiniFanoChord coordinates scaled to viewBox 0 0 180 155
const PTS: Record<number, [number, number]> = {
  2: [90, 15], // Red - top vertex
  1: [17, 122], // Blue - bottom-left vertex
  4: [163, 122], // Green - bottom-right vertex
  3: [53.5, 68.5], // Magenta - midpoint of left edge (1↔2)
  6: [126.5, 68.5], // Yellow - midpoint of right edge (2↔4)
  5: [90, 122], // Cyan - midpoint of bottom edge (1↔4)
  7: [90, 86.3], // White - centroid (exact: (17+90+163)/3, (122+15+122)/3)
};

// Inscribed circle line index
const CIRCLE_LINE_INDEX = FANO_LINES.length - 1; // [3, 5, 6]

function pointColor(lv: number, activeLevels: XorFanoLineProps["activeLevels"]): string {
  const found = activeLevels.find((l) => l.lv === lv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[lv] ?? "#888";
}

function linePath(line: readonly number[]): string {
  const pts = line.map((lv) => PTS[lv]);
  return `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]} L${pts[2][0]},${pts[2][1]}`;
}

function inscribedCirclePath(): string {
  const [x3, y3] = PTS[3];
  const [x5, y5] = PTS[5];
  const [x6, y6] = PTS[6];
  const cx = (x3 + x5 + x6) / 3;
  const cy = (y3 + y5 + y6) / 3;
  const r = Math.sqrt((x3 - cx) ** 2 + (y3 - cy) ** 2);
  return `M${x3},${y3} A${r},${r} 0 1,0 ${x5},${y5} A${r},${r} 0 0,0 ${x6},${y6} A${r},${r} 0 0,0 ${x3},${y3}`;
}

export const XorFanoLine = React.memo(function XorFanoLine({ stepLv, lvA, lvB, activeLevels }: XorFanoLineProps) {
  const xorResult = lvA !== null && lvB !== null ? lvA ^ lvB : null;
  const activeLineIdx = lvA !== null && lvB !== null ? FANO_LINES.findIndex((line) => line.includes(lvA) && line.includes(lvB)) : -1;

  const labelA = lvA !== null ? lvA : "?";
  const labelB = lvB !== null ? lvB : "?";
  const labelC = xorResult !== null ? xorResult : "?";

  return (
    <svg viewBox="0 0 180 155" style={{ width: "100%", maxWidth: 180, aspectRatio: "180/155" }}>
      <defs>
        <filter id="xfl-pulse" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="xfl-ring" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <style>{`
        @keyframes xfl-ring-anim {
          0% { r: 9; opacity: 1; }
          50% { r: 14; opacity: 0.4; }
          100% { r: 9; opacity: 1; }
        }
        .xfl-ring { animation: xfl-ring-anim 0.8s ease-in-out infinite; }
      `}</style>

      {/* Lines */}
      {FANO_LINES.map((line, i) => {
        const isActive = i === activeLineIdx;
        const isCircle = i === CIRCLE_LINE_INDEX;
        const d = isCircle ? inscribedCirclePath() : linePath(line);
        // Line color = dual point's color (dynamic via activeLevels)
        const lineColor = pointColor(LINE_DUAL_POINTS[i], activeLevels);
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={isActive ? lineColor : lineColor}
            strokeWidth={isActive ? 2.5 : 1}
            opacity={isActive ? 1 : 0.15}
            strokeLinecap="round"
          />
        );
      })}

      {/* Points */}
      {[1, 2, 3, 4, 5, 6, 7].map((lv) => {
        const [px, py] = PTS[lv];
        const col = pointColor(lv, activeLevels);
        const isStep = stepLv === lv;
        const isXorResult = xorResult !== null && lv === xorResult;
        const isXorRing = isXorResult && stepLv === xorResult;
        const r = isStep ? 10 : 7;
        const textColor = lv >= 4 ? "#000" : "#fff";

        return (
          <g key={lv}>
            {/* XOR result ring animation */}
            {isXorRing && (
              <circle className="xfl-ring" cx={px} cy={py} r={9} fill="none" stroke={col} strokeWidth={2} filter="url(#xfl-ring)" />
            )}
            <circle cx={px} cy={py} r={r} fill={col} stroke="#fff" strokeWidth={1} filter={isStep ? "url(#xfl-pulse)" : undefined} />
            <text x={px} y={py + 3} fontSize={8} fill={textColor} textAnchor="middle" pointerEvents="none">
              {lv}
            </text>
          </g>
        );
      })}

      {/* XOR label */}
      <text x={90} y={150} fontSize={10} fill={C.textSecondary} textAnchor="middle">
        {labelA}&#8853;{labelB}={labelC}
      </text>
    </svg>
  );
});
