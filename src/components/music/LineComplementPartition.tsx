import React from "react";
import { C, R } from "../../tokens";
import { useTranslation } from "../../i18n";
import { FANO_LINES } from "../theory/theory-data";

interface LineComplementPartitionProps {
  phase: "line" | "complement" | null;
  lineIndex: number;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

const ALL_POINTS = [1, 2, 3, 4, 5, 6, 7];
const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

function pointColor(lv: number, activeLevels: LineComplementPartitionProps["activeLevels"]): string {
  const found = activeLevels.find((l) => l.lv === lv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[lv] ?? "#888";
}

export const LineComplementPartition = React.memo(function LineComplementPartition({
  phase,
  lineIndex,
  activeLevels,
}: LineComplementPartitionProps) {
  const { t } = useTranslation();
  const linePoints = FANO_LINES[lineIndex] ?? [1, 2, 3];
  const complementPoints = ALL_POINTS.filter((p) => !linePoints.includes(p));

  return (
    <svg
      viewBox="0 0 180 100"
      style={{ width: "100%", maxWidth: 180, aspectRatio: "180/100", borderRadius: R.md, border: `1px solid ${C.border}` }}
    >
      <rect width={180} height={100} fill={C.bgPanel} rx={R.md} />

      {/* Bracket labels */}
      {phase === "line" && (
        <g>
          <text x={90} y={12} fontSize={8} fill={C.accent} textAnchor="middle">
            {t("music_partition_line")}
          </text>
        </g>
      )}
      {phase === "complement" && (
        <g>
          <text x={90} y={12} fontSize={8} fill={C.accent} textAnchor="middle">
            {t("music_partition_line")}
          </text>
          <text x={90} y={96} fontSize={8} fill={C.textDimmer} textAnchor="middle">
            {t("music_partition_complement")}
          </text>
        </g>
      )}

      {/* Points */}
      {ALL_POINTS.map((lv, i) => {
        const x = 15 + i * 23;
        const isLine = linePoints.includes(lv);
        const isComplement = complementPoints.includes(lv);

        let y = 50;
        let bright = false;
        if (phase === "line" && isLine) {
          y = 25;
          bright = true;
        } else if (phase === "complement") {
          if (isLine) {
            y = 25;
            bright = true;
          }
          if (isComplement) {
            y = 75;
            bright = true;
          }
        }

        const color = pointColor(lv, activeLevels);
        const opacity = phase === null ? 0.4 : bright ? 1 : 0.2;

        return (
          <g key={lv}>
            <circle cx={x} cy={y} r={8} fill={color} opacity={opacity} style={{ transition: "cy 0.3s ease, opacity 0.3s ease" }} />
            <text
              x={x}
              y={y + 3}
              fontSize={8}
              fill="#fff"
              textAnchor="middle"
              pointerEvents="none"
              opacity={opacity}
              style={{ transition: "y 0.3s ease, opacity 0.3s ease" }}
            >
              {lv}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
