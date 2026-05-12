import React from "react";
import { C } from "../styles/tokens";
import { S_CURSOR_POINTER } from "../styles/shared";
import { BXright, BY, C2_PAIR, LV_COLORS, TW, type LinkedVisualizationDot } from "./linked-visualization-geometry";

interface LinkedVisualizationHover {
  levelIndex: number;
  candidateIndex: number;
}

type DotHandlers = (d: LinkedVisualizationDot) => {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  style: React.CSSProperties;
};

interface LinkedVisualizationLegendProps {
  activeDots: LinkedVisualizationDot[];
  hoveredDot: LinkedVisualizationHover | null;
  setHoveredDot: (d: LinkedVisualizationHover | null) => void;
  dotHandlers: DotHandlers;
  legendL0: string;
  legendL7: string;
}

export function LinkedVisualizationLegend({
  activeDots,
  hoveredDot,
  setHoveredDot,
  dotHandlers,
  legendL0,
  legendL7,
}: LinkedVisualizationLegendProps) {
  const hovIdx = hoveredDot
    ? activeDots.findIndex((d) => d.levelIndex === hoveredDot.levelIndex && d.candidateIndex === hoveredDot.candidateIndex)
    : -1;
  const ix = BXright + 12;
  const ixRgb = ix + 60;
  const ixC2 = ixRgb + 70;
  const ROW_H = 18;
  let yOffset = BY + 20;

  const l0y = yOffset;
  yOffset += ROW_H;

  const dotElements = activeDots.map((d, i) => {
    const col = `rgb(${d.rgb.join(",")})`;
    const y = yOffset;
    const hov = hovIdx === i;
    yOffset += ROW_H;
    return (
      <g key={`info-${d.levelIndex}-${d.candidateIndex}`} opacity={hov ? 1 : hoveredDot !== null ? 0.3 : 0.8} {...dotHandlers(d)}>
        <rect x={ix - 2} y={y - 4} width={TW - ix} height={ROW_H} fill="transparent" pointerEvents="all" />
        <rect x={ix} y={y} width={11} height={11} rx={2} fill={col} stroke={hov ? C.accent : "none"} strokeWidth={hov ? 0.5 : 0} />
        <text x={ix + 15} y={y + 9} fontSize={10} fill={hov ? C.textPrimary : C.textDimmer}>
          L{d.levelIndex}{" "}
          <tspan style={{ fontVariantNumeric: "tabular-nums" }}>{String(Math.round(d.angleDeg)).padStart(3, "\u2007")}°</tspan>
        </text>
        <text x={ixRgb} y={y + 9} fontSize={10} fill={C.textDimmer}>
          ({d.rgb.join(",")})
        </text>
        {(() => {
          const pairLv = C2_PAIR[d.levelIndex];
          const pairDot = activeDots.find((ad) => ad.levelIndex === pairLv);
          const pairCol = pairDot ? `rgb(${pairDot.rgb.join(",")})` : LV_COLORS[pairLv];
          return (
            <>
              <text x={ixC2} y={y + 9} fontSize={10} fill={C.textDimmer}>
                ↔
              </text>
              <rect x={ixC2 + 12} y={y + 1} width={9} height={9} rx={2} fill={pairCol} opacity={0.8} />
              <text x={ixC2 + 24} y={y + 9} fontSize={10} fill={C.textDimmer}>
                L{pairLv}
              </text>
            </>
          );
        })()}
      </g>
    );
  });

  const l7y = yOffset;
  const hovL0 = hoveredDot !== null && hoveredDot.levelIndex === 0;
  const hovL7 = hoveredDot !== null && hoveredDot.levelIndex === 7;

  return (
    <g>
      <g
        key="legend-l0"
        opacity={hovL0 ? 1 : hoveredDot !== null ? 0.3 : 0.8}
        onPointerEnter={() => setHoveredDot({ levelIndex: 0, candidateIndex: -1 })}
        onPointerLeave={() => setHoveredDot(null)}
        style={S_CURSOR_POINTER}
      >
        <rect x={ix - 2} y={l0y - 4} width={TW - ix} height={ROW_H} fill="transparent" pointerEvents="all" />
        <rect
          x={ix}
          y={l0y + 1}
          width={11}
          height={11}
          rx={2}
          fill="#222"
          stroke={hovL0 ? C.accent : "rgba(255,255,255,0.5)"}
          strokeWidth={hovL0 ? 0.8 : 0.6}
        />
        <text x={ix + 15} y={l0y + 9} fontSize={10} fill={hovL0 ? C.textPrimary : C.textDimmer}>
          {legendL0}
        </text>
        <text x={ixRgb} y={l0y + 9} fontSize={10} fill={C.textDimmer}>
          (0,0,0)
        </text>
        <text x={ixC2} y={l0y + 9} fontSize={10} fill={C.textDimmer}>
          ↔
        </text>
        <rect x={ixC2 + 12} y={l0y + 1} width={9} height={9} rx={2} fill="#fff" opacity={0.8} />
        <text x={ixC2 + 24} y={l0y + 9} fontSize={10} fill={C.textDimmer}>
          L7
        </text>
      </g>
      {dotElements}
      <g
        key="legend-l7"
        opacity={hovL7 ? 1 : hoveredDot !== null ? 0.3 : 0.8}
        onPointerEnter={() => setHoveredDot({ levelIndex: 7, candidateIndex: -1 })}
        onPointerLeave={() => setHoveredDot(null)}
        style={S_CURSOR_POINTER}
      >
        <rect x={ix - 2} y={l7y - 4} width={TW - ix} height={ROW_H} fill="transparent" pointerEvents="all" />
        <rect
          x={ix}
          y={l7y + 1}
          width={11}
          height={11}
          rx={2}
          fill="#fff"
          stroke={hovL7 ? C.accent : "rgba(0,0,0,0.5)"}
          strokeWidth={hovL7 ? 0.8 : 0.6}
        />
        <text x={ix + 15} y={l7y + 9} fontSize={10} fill={hovL7 ? C.textPrimary : C.textDimmer}>
          {legendL7}
        </text>
        <text x={ixRgb} y={l7y + 9} fontSize={10} fill={C.textDimmer}>
          (255,255,255)
        </text>
        <text x={ixC2} y={l7y + 9} fontSize={10} fill={C.textDimmer}>
          ↔
        </text>
        <rect
          x={ixC2 + 12}
          y={l7y + 1}
          width={9}
          height={9}
          rx={2}
          fill="#222"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={0.4}
          opacity={0.8}
        />
        <text x={ixC2 + 24} y={l7y + 9} fontSize={10} fill={C.textDimmer}>
          L0
        </text>
      </g>
    </g>
  );
}
