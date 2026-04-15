import React from "react";
import { C } from "../../tokens";

interface CayleyGridProps {
  row: number;
  activeCol: number;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

const CELL = 16;
const GAP = 1;
const HEADER = 12;
const LEFT = HEADER + 4;
const TOP = HEADER + 4;

export const CayleyGrid = React.memo(function CayleyGrid({ row, activeCol, activeLevels: _activeLevels }: CayleyGridProps) {
  return (
    <svg viewBox="0 0 160 160" style={{ width: "100%", aspectRatio: "1" }}>
      <defs>
        <filter id="cg-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Column headers */}
      {Array.from({ length: 8 }, (_, c) => (
        <text key={`ch-${c}`} x={LEFT + c * (CELL + GAP) + CELL / 2} y={HEADER} fontSize={8} fill={C.textDimmer} textAnchor="middle">
          {c}
        </text>
      ))}

      {/* Row headers */}
      {Array.from({ length: 8 }, (_, r) => (
        <text
          key={`rh-${r}`}
          x={HEADER}
          y={TOP + r * (CELL + GAP) + CELL / 2 + 3}
          fontSize={8}
          fill={r === row ? "#fff" : C.textDimmer}
          textAnchor="end"
          fontWeight={r === row ? 700 : 400}
        >
          {r}
        </text>
      ))}

      {/* Grid cells */}
      {Array.from({ length: 8 }, (_, r) =>
        Array.from({ length: 8 }, (_, c) => {
          const xorVal = r ^ c;
          const x = LEFT + c * (CELL + GAP);
          const y = TOP + r * (CELL + GAP);
          const isSelectedRow = r === row;
          const isActiveCell = r === row && c === activeCol;
          const isMirrorCell = c === row && r === activeCol && activeCol >= 0;

          let strokeColor = "transparent";
          let strokeWidth = 0;
          let filter: string | undefined;

          if (isActiveCell && activeCol >= 0) {
            strokeColor = "#fff";
            strokeWidth = 2;
            filter = "url(#cg-glow)";
          } else if (isMirrorCell) {
            strokeColor = "rgba(255,255,255,0.4)";
            strokeWidth = 1.5;
          } else if (isSelectedRow) {
            strokeColor = "rgba(255,255,255,0.3)";
            strokeWidth = 1;
          }

          return (
            <g key={`${r}-${c}`} filter={filter}>
              <rect x={x} y={y} width={CELL} height={CELL} rx={1} fill={LV_COLORS[xorVal]} stroke={strokeColor} strokeWidth={strokeWidth} />
            </g>
          );
        }),
      )}
    </svg>
  );
});
