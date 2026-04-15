import React from "react";
import { C } from "../../tokens";

interface GrayCubeProps {
  currentCode: number | null;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

const FULL_GRAY_CODE = [0, 1, 3, 2, 6, 7, 5, 4];

// Isometric cube vertex positions
const VERTS: Record<number, [number, number]> = {
  0: [50, 110], // 000
  1: [20, 90], // 001
  2: [110, 90], // 010
  3: [80, 70], // 011
  4: [50, 50], // 100
  5: [20, 30], // 101
  6: [110, 30], // 110
  7: [80, 10], // 111
};

// All 12 cube edges: pairs of vertices differing by exactly 1 bit
const CUBE_EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 4],
  [1, 3],
  [1, 5],
  [2, 3],
  [2, 6],
  [3, 7],
  [4, 5],
  [4, 6],
  [5, 7],
  [6, 7],
];

// Which bit changed between two adjacent Gray code values
function changedBit(a: number, b: number): number {
  const diff = a ^ b;
  if (diff === 1) return 0; // B (blue)
  if (diff === 2) return 1; // R (red)
  if (diff === 4) return 2; // G (green)
  return -1;
}

const BIT_COLORS = ["#0000ff", "#ff0000", "#00ff00"];
const BIT_LABELS = ["B", "R", "G"];

function toBinary(n: number): string {
  return n.toString(2).padStart(3, "0");
}

export const GrayCube = React.memo(function GrayCube({ currentCode, activeLevels: _activeLevels }: GrayCubeProps) {
  const currentIdx = currentCode !== null ? FULL_GRAY_CODE.indexOf(currentCode) : -1;

  return (
    <svg viewBox="0 -6 140 148" style={{ width: "100%", aspectRatio: "140/148" }}>
      <defs>
        <filter id="gc-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Cube edges (thin, dim) */}
      {CUBE_EDGES.map(([a, b], i) => {
        const [x1, y1] = VERTS[a];
        const [x2, y2] = VERTS[b];
        return <line key={`edge-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.textDimmer} strokeWidth={0.5} opacity={0.2} />;
      })}

      {/* Gray code path segments */}
      {FULL_GRAY_CODE.slice(0, -1).map((code, i) => {
        const next = FULL_GRAY_CODE[i + 1];
        const [x1, y1] = VERTS[code];
        const [x2, y2] = VERTS[next];
        const bit = changedBit(code, next);
        const color = bit >= 0 ? BIT_COLORS[bit] : C.textDimmer;

        const isVisited = currentIdx >= 0 && i < currentIdx;
        const isCurrent = currentIdx >= 0 && i === currentIdx;

        return (
          <line
            key={`path-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth={isVisited || isCurrent ? 2.5 : 1.5}
            opacity={isVisited || isCurrent ? 1 : 0.4}
            strokeDasharray={isVisited || isCurrent ? "none" : "3 3"}
            strokeLinecap="round"
          />
        );
      })}

      {/* Vertices */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((v) => {
        const [vx, vy] = VERTS[v];
        const isCurrent = currentCode === v;
        const r = isCurrent ? 8 : 4;
        const col = LV_COLORS[v];

        return (
          <g key={v}>
            <circle
              cx={vx}
              cy={vy}
              r={r}
              fill={col}
              stroke="#fff"
              strokeWidth={isCurrent ? 1.5 : 0.5}
              filter={isCurrent ? "url(#gc-glow)" : undefined}
            />
            <text x={vx} y={vy + (vy < 60 ? -8 : 16)} fontSize={7} fill={C.textDimmer} textAnchor="middle">
              {toBinary(v)}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {BIT_LABELS.map((label, i) => (
        <g key={`legend-${i}`}>
          <line x1={10 + i * 40} y1={137} x2={22 + i * 40} y2={137} stroke={BIT_COLORS[i]} strokeWidth={2} />
          <text x={26 + i * 40} y={140} fontSize={7} fill={BIT_COLORS[i]}>
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
});
