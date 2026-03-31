import React from "react";
import { C } from "../../tokens";

interface XorFanoLineProps {
  stepLv: number | null;
  lvA: number | null;
  lvB: number | null;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

const FANO_LINES = [
  [1, 2, 3],
  [1, 4, 5],
  [2, 4, 6],
  [1, 6, 7],
  [2, 5, 7],
  [3, 4, 7],
  [3, 5, 6],
];

const PTS: Record<number, [number, number]> = {
  1: [90, 15],
  2: [30, 45],
  3: [150, 45],
  4: [55, 95],
  5: [125, 95],
  6: [90, 130],
  7: [90, 70],
};

function pointColor(lv: number, activeLevels: XorFanoLineProps["activeLevels"]): string {
  const found = activeLevels.find((l) => l.lv === lv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[lv] ?? "#888";
}

function linePath(line: number[]): string {
  const pts = line.map((lv) => PTS[lv]);
  return `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]} L${pts[2][0]},${pts[2][1]}`;
}

function arcPath(): string {
  const [x1, y1] = PTS[3];
  const [x2, y2] = PTS[5];
  const [x3, y3] = PTS[6];
  const cx = (x1 + x2 + x3) / 3;
  const cy = (y1 + y2 + y3) / 3;
  const r = Math.sqrt((x1 - cx) ** 2 + (y1 - cy) ** 2);
  return `M${x1},${y1} A${r},${r} 0 1,0 ${x2},${y2} A${r},${r} 0 0,0 ${x3},${y3} A${r},${r} 0 0,0 ${x1},${y1}`;
}

export const XorFanoLine = React.memo(function XorFanoLine({ stepLv, lvA, lvB, activeLevels }: XorFanoLineProps) {
  const xorResult = lvA !== null && lvB !== null ? lvA ^ lvB : null;
  const activeLineIdx = lvA !== null && lvB !== null ? FANO_LINES.findIndex((line) => line.includes(lvA) && line.includes(lvB)) : -1;

  const labelA = lvA !== null ? lvA : "?";
  const labelB = lvB !== null ? lvB : "?";
  const labelC = xorResult !== null ? xorResult : "?";

  return (
    <svg width={180} height={140} viewBox="0 0 180 140">
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
        const isCircle = i === 6;
        const d = isCircle ? arcPath() : linePath(line);
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={isActive ? C.accent : C.textDimmer}
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

        return (
          <g key={lv}>
            {/* XOR result ring animation */}
            {isXorRing && (
              <circle className="xfl-ring" cx={px} cy={py} r={9} fill="none" stroke={col} strokeWidth={2} filter="url(#xfl-ring)" />
            )}
            <circle cx={px} cy={py} r={r} fill={col} stroke="#fff" strokeWidth={1} filter={isStep ? "url(#xfl-pulse)" : undefined} />
            <text x={px} y={py + 3} fontSize={8} fill="#fff" textAnchor="middle" pointerEvents="none">
              {lv}
            </text>
          </g>
        );
      })}

      {/* XOR label */}
      <text x={90} y={140} fontSize={10} fill={C.textSecondary} textAnchor="middle">
        {labelA}&#8853;{labelB}={labelC}
      </text>
    </svg>
  );
});
