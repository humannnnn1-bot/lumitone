import React from "react";
import { C } from "../../tokens";

interface MiniFanoChordProps {
  hoveredLine: number | null;
  onLineHover: (lineIndex: number | null) => void;
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

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

// Point positions for the classic Fano plane layout
const PTS: Record<number, [number, number]> = {
  1: [100, 20], // Blue - top
  2: [40, 60], // Red - left
  3: [160, 60], // Magenta - right
  4: [70, 120], // Green - lower-left
  5: [130, 120], // Cyan - lower-right
  6: [100, 160], // Yellow - bottom
  7: [100, 90], // White - center
};

function pointColor(lv: number, activeLevels: MiniFanoChordProps["activeLevels"]): string {
  const found = activeLevels.find((l) => l.lv === lv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[lv] ?? "#888";
}

function linePath(line: number[]): string {
  const pts = line.map((lv) => PTS[lv]);
  return `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]} L${pts[2][0]},${pts[2][1]}`;
}

// The inscribed circle line [3,5,6] — draw as arc
function arcPath(): string {
  const [x1, y1] = PTS[3]; // Magenta
  const [x2, y2] = PTS[5]; // Cyan
  const [x3, y3] = PTS[6]; // Yellow
  // Circumscribed arc through 3 points — approximate with quadratic bezier
  const cx = (x1 + x2 + x3) / 3;
  const cy = (y1 + y2 + y3) / 3;
  const r = Math.sqrt((x1 - cx) ** 2 + (y1 - cy) ** 2);
  return `M${x1},${y1} A${r},${r} 0 1,0 ${x2},${y2} A${r},${r} 0 0,0 ${x3},${y3} A${r},${r} 0 0,0 ${x1},${y1}`;
}

export const MiniFanoChord = React.memo(function MiniFanoChord({ hoveredLine, onLineHover, activeLevels }: MiniFanoChordProps) {
  const anyHovered = hoveredLine !== null;

  return (
    <svg viewBox="0 0 200 180" style={{ width: "100%", maxWidth: 300, aspectRatio: "200/180" }}>
      <defs>
        <filter id="fano-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Lines */}
      {FANO_LINES.map((line, i) => {
        const isHovered = hoveredLine === i;
        const opacity = anyHovered ? (isHovered ? 1 : 0.2) : 0.5;
        const sw = isHovered ? 3 : 1.5;
        const isCircle = i === 6; // [3,5,6] inscribed circle
        const d = isCircle ? arcPath() : linePath(line);
        const color = isHovered ? C.accent : C.textDimmer;

        return (
          <g key={i}>
            {/* Wide transparent hit area */}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              style={{ cursor: "pointer" }}
              onPointerEnter={() => onLineHover(i)}
              onPointerLeave={() => onLineHover(null)}
            />
            {/* Visible line */}
            <path d={d} fill="none" stroke={color} strokeWidth={sw} opacity={opacity} strokeLinecap="round" pointerEvents="none" />
          </g>
        );
      })}

      {/* Points */}
      {[1, 2, 3, 4, 5, 6, 7].map((lv) => {
        const [px, py] = PTS[lv];
        const isOnHoveredLine = hoveredLine !== null && FANO_LINES[hoveredLine].includes(lv);
        const r = isOnHoveredLine ? 10 : 8;
        const col = pointColor(lv, activeLevels);

        return (
          <g key={lv} filter={isOnHoveredLine ? "url(#fano-glow)" : undefined}>
            <circle cx={px} cy={py} r={r} fill={col} stroke="#fff" strokeWidth={1} opacity={anyHovered && !isOnHoveredLine ? 0.3 : 1} />
            <text
              x={px}
              y={py + 3.5}
              fontSize={9}
              fill="#fff"
              textAnchor="middle"
              pointerEvents="none"
              opacity={anyHovered && !isOnHoveredLine ? 0.3 : 1}
            >
              {lv}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
