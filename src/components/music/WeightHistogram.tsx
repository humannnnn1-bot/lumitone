import React from "react";
import { C, R } from "../../tokens";

interface WeightHistogramProps {
  currentWeight: number; // -1, 0, 3, 4, or 7
  currentIndex: number; // 0-15, which codeword
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

const WEIGHTS = [0, 3, 4, 7] as const;
const COUNTS: Record<number, number> = { 0: 1, 3: 7, 4: 7, 7: 1 };
const MAX_H = 70;
const BAR_W = 30;
const BAR_GAP = 10;
const CELL_H = 10;

const LEFT = 25;
const TOP = 14;
const BOTTOM = TOP + MAX_H + 4;

export const WeightHistogram = React.memo(function WeightHistogram({
  currentWeight,
  currentIndex,
  activeLevels: _activeLevels,
}: WeightHistogramProps) {
  return (
    <svg width={180} height={100} viewBox="0 0 180 100" style={{ borderRadius: R.md, border: `1px solid ${C.border}` }}>
      <rect width={180} height={100} fill={C.bgPanel} rx={R.md} />

      <defs>
        <filter id="wh-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {WEIGHTS.map((w, i) => {
        const count = COUNTS[w];
        const barH = (count / 7) * MAX_H;
        const x = LEFT + i * (BAR_W + BAR_GAP);
        const y = TOP + MAX_H - barH;
        const isActive = currentWeight === w;

        if (count > 1) {
          // Stacked cells for w=3 and w=4
          const cells = Array.from({ length: count }, (_, ci) => {
            const cellY = TOP + MAX_H - (ci + 1) * CELL_H;
            const cellActive = isActive && ci === currentIndex % count;
            return (
              <rect
                key={`${w}-${ci}`}
                x={x}
                y={cellY}
                width={BAR_W}
                height={CELL_H - 1}
                rx={1}
                fill={C.accent}
                opacity={cellActive ? 1 : isActive ? 0.5 : 0.25}
                filter={cellActive ? "url(#wh-glow)" : undefined}
              />
            );
          });

          return (
            <g key={w}>
              {cells}
              {/* Count label above */}
              <text x={x + BAR_W / 2} y={y - 3} fontSize={8} fill={C.textDimmer} textAnchor="middle">
                {count}
              </text>
              {/* Weight label below */}
              <text x={x + BAR_W / 2} y={BOTTOM + 10} fontSize={8} fill={C.textDimmer} textAnchor="middle">
                w={w}
              </text>
            </g>
          );
        }

        // Single cell for w=0 and w=7
        return (
          <g key={w}>
            <rect
              x={x}
              y={TOP + MAX_H - CELL_H}
              width={BAR_W}
              height={CELL_H}
              rx={1}
              fill={C.accent}
              opacity={isActive ? 1 : 0.25}
              filter={isActive ? "url(#wh-glow)" : undefined}
            />
            {/* Count label above */}
            <text x={x + BAR_W / 2} y={TOP + MAX_H - CELL_H - 3} fontSize={8} fill={C.textDimmer} textAnchor="middle">
              {count}
            </text>
            {/* Weight label below */}
            <text x={x + BAR_W / 2} y={BOTTOM + 10} fontSize={8} fill={C.textDimmer} textAnchor="middle">
              w={w}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
