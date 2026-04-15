import React from "react";
import { C, FS, FW } from "../../tokens";
import { useTranslation } from "../../i18n";
import { TETRA_T0, TETRA_T1 } from "../theory/theory-data";
import { COLOR_T0, COLOR_T1 } from "./K8LayerGraph";

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];
const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
];

function pointColor(lv: number, activeLevels: { lv: number; rgb: [number, number, number] }[]): string {
  const found = activeLevels.find((l) => l.lv === lv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[lv] ?? "#888";
}

function textColor(lv: number): string {
  return lv >= 4 ? "#000" : "#fff";
}

function groupPoints(cx: number): Record<number, [number, number]> {
  return {
    0: [cx, 26],
    1: [cx - 22, 56],
    2: [cx + 22, 56],
    3: [cx, 88],
  };
}

interface Props {
  phase: "t0" | "t1" | null;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

export const TetraSplitView = React.memo(function TetraSplitView({ phase, activeLevels }: Props) {
  const { t } = useTranslation();
  const groups = [
    { key: "t0" as const, label: "T0", subtitle: t("music_tetra_even"), centerX: 48, levels: [...TETRA_T0], color: COLOR_T0 },
    { key: "t1" as const, label: "T1", subtitle: t("music_tetra_odd"), centerX: 132, levels: [...TETRA_T1], color: COLOR_T1 },
  ];

  return (
    <svg viewBox="4 1 172 116" style={{ width: "100%" }}>
      <defs>
        <filter id="tetra-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {groups.map((group) => {
        const points = groupPoints(group.centerX);
        const active = phase === group.key;
        const dimmed = phase !== null && !active;
        const opacity = dimmed ? 0.25 : 1;

        return (
          <g key={group.key} opacity={opacity} filter={active ? "url(#tetra-glow)" : undefined}>
            <text x={group.centerX} y={12} textAnchor="middle" fontSize={8} fill={C.textDimmer}>
              {group.label}
            </text>
            <text x={group.centerX} y={112} textAnchor="middle" fontSize={7} fill={C.textDimmer}>
              {group.subtitle}
            </text>

            {EDGES.map(([a, b], i) => (
              <line
                key={`${group.key}-${i}`}
                x1={points[a][0]}
                y1={points[a][1]}
                x2={points[b][0]}
                y2={points[b][1]}
                stroke={group.color}
                strokeWidth={active ? 1.5 : 1}
              />
            ))}

            {group.levels.map((lv, i) => {
              const [x, y] = points[i];
              return (
                <g key={lv}>
                  <circle cx={x} cy={y} r={active ? 9 : 8} fill={pointColor(lv, activeLevels)} stroke="#fff" strokeWidth={1} />
                  <text x={x} y={y + 3.5} textAnchor="middle" fontSize={FS.xs} fontWeight={FW.bold} fill={textColor(lv)}>
                    {lv}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
});
