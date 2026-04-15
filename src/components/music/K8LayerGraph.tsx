import React from "react";
import { C, FS, FW } from "../../tokens";
import { useTranslation } from "../../i18n";
import { COMPLEMENT_EDGES, CUBE_EDGES, STELLA_EDGES, TETRA_T0, TETRA_T0_EDGES } from "../theory/theory-data";

export const COLOR_T0 = "#ffd36e";
export const COLOR_T1 = "#90c8ff";

const VERTS: Record<number, [number, number]> = {
  0: [50, 116],
  1: [18, 95],
  2: [114, 95],
  3: [82, 74],
  4: [50, 52],
  5: [18, 30],
  6: [114, 30],
  7: [82, 10],
};

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

const LAYERS = {
  1: { edges: CUBE_EDGES, labelKey: "music_k8_d1", color: "#6ea4ff" },
  2: { edges: STELLA_EDGES, labelKey: "music_k8_d2", color: "#ffd36e" },
  3: { edges: COMPLEMENT_EDGES, labelKey: "music_k8_d3", color: "#ff8f8f" },
} as const;

function pointColor(lv: number, activeLevels: { lv: number; rgb: [number, number, number] }[]): string {
  const found = activeLevels.find((l) => l.lv === lv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[lv] ?? "#888";
}

function textColor(lv: number): string {
  return lv >= 4 ? "#000" : "#fff";
}

interface Props {
  layer: 1 | 2 | 3;
  activeEdgeIndex: number;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
  tetraPhase?: "t0" | "t1" | null;
}

export const K8LayerGraph = React.memo(function K8LayerGraph({ layer, activeEdgeIndex, activeLevels, tetraPhase }: Props) {
  const { t } = useTranslation();
  const layerInfo = LAYERS[layer];
  const t0Split = TETRA_T0_EDGES.length; // 6
  const t0Set = new Set(TETRA_T0 as readonly number[]);

  return (
    <svg viewBox="0 0 180 134" style={{ width: "100%", maxWidth: 180 }}>
      <defs>
        <filter id="k8-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <text x={90} y={10} textAnchor="middle" fontSize={8} fill={C.textDimmer}>
        {t(layerInfo.labelKey)}
      </text>

      {layerInfo.edges.map(([a, b], i) => {
        const active = activeEdgeIndex === i;
        const isT0Edge = layer === 2 && i < t0Split;
        const isT1Edge = layer === 2 && i >= t0Split;
        const edgeColor = isT0Edge ? COLOR_T0 : isT1Edge ? COLOR_T1 : layerInfo.color;
        const phaseDimmed = layer === 2 && tetraPhase !== null && (tetraPhase === "t0" ? isT1Edge : isT0Edge);
        return (
          <line
            key={`${a}-${b}-${i}`}
            x1={VERTS[a][0]}
            y1={VERTS[a][1]}
            x2={VERTS[b][0]}
            y2={VERTS[b][1]}
            stroke={edgeColor}
            strokeWidth={active ? 2.5 : 1.2}
            opacity={phaseDimmed ? 0.12 : active ? 1 : 0.4}
            strokeDasharray={layer === 3 ? "4,2" : undefined}
            filter={active ? "url(#k8-glow)" : undefined}
          />
        );
      })}

      {[0, 1, 2, 3, 4, 5, 6, 7].map((lv) => {
        const [x, y] = VERTS[lv];
        const active = activeEdgeIndex >= 0 && layerInfo.edges[activeEdgeIndex]?.includes(lv);
        const vertDimmed = layer === 2 && tetraPhase !== null && (tetraPhase === "t0" ? !t0Set.has(lv) : t0Set.has(lv));
        return (
          <g key={lv} filter={active ? "url(#k8-glow)" : undefined} opacity={vertDimmed ? 0.25 : 1}>
            <circle cx={x} cy={y} r={active ? 8 : 5} fill={pointColor(lv, activeLevels)} stroke="#fff" strokeWidth={active ? 1.5 : 0.8} />
            <text x={x} y={y + 3} textAnchor="middle" fontSize={FS.xxs} fontWeight={FW.bold} fill={textColor(lv)}>
              {lv}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
