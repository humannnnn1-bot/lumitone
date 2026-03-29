import React, { useState, useCallback } from "react";
import { THEORY_LEVELS, FANO_LINES, FANO_LINE_CATEGORIES, FANO_LINE_ENDPOINTS, FANO_POINTS, FANO_CIRCLE } from "./theory-data";
import { FS, FW } from "../../tokens";
import { useTranslation } from "../../i18n";

const W = 300,
  H = 340;
const DOT_R = 16;

const COLOR_NAMES: Record<number, string> = { 1: "B", 2: "R", 3: "M", 4: "G", 5: "C", 6: "Y", 7: "W" };

function linesThrough(point: number): number[] {
  return FANO_LINES.map((line, i) => (line.includes(point) ? i : -1)).filter((i) => i >= 0);
}

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const FanoPlane = React.memo(function FanoPlane({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<number | null>(null);

  // External highlight takes priority, then pinned, then null
  const hl = hlLevel !== null && hlLevel >= 1 && hlLevel <= 7 ? hlLevel : pinned;
  const hlLines = hl !== null ? linesThrough(hl) : [];
  const hlPoints = new Set<number>();
  if (hl !== null) {
    hlPoints.add(hl);
    for (const li of hlLines) for (const p of FANO_LINES[li]) hlPoints.add(p);
  }

  const onEnter = useCallback((lv: number) => onHover(lv), [onHover]);
  const onLeave = useCallback(() => onHover(null), [onHover]);
  const onTap = useCallback(
    (lv: number) => {
      setPinned((prev) => {
        const next = prev === lv ? null : lv;
        // Defer parent update to avoid setState-during-render
        queueMicrotask(() => onHover(next));
        return next;
      });
    },
    [onHover],
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }} role="img" aria-label={t("theory_fano_title")}>
      {/* Lines */}
      {FANO_LINES.map((_, li) => {
        const active = hlLines.includes(li);
        const dim = hl !== null && !active;
        const cat = FANO_LINE_CATEGORIES[li];
        const baseOpacity = dim ? 0.12 : active ? 0.9 : 0.3;
        const strokeColor = cat === "primary" ? "#80a0ff" : cat === "complement" ? "#ffa060" : "#60ffa0";

        if (li === 6) {
          return (
            <circle
              key={"fl" + li}
              cx={FANO_CIRCLE.cx}
              cy={FANO_CIRCLE.cy}
              r={FANO_CIRCLE.r}
              fill="none"
              stroke={strokeColor}
              strokeWidth={active ? 2 : 1.2}
              opacity={baseOpacity}
            />
          );
        }
        const ep = FANO_LINE_ENDPOINTS[li];
        const p0 = FANO_POINTS[ep[0]],
          p1 = FANO_POINTS[ep[1]];
        return (
          <line
            key={"fl" + li}
            x1={p0.x}
            y1={p0.y}
            x2={p1.x}
            y2={p1.y}
            stroke={strokeColor}
            strokeWidth={active ? 2 : 1.2}
            opacity={baseOpacity}
          />
        );
      })}

      {/* XOR equations + mixing labels for highlighted lines */}
      {hlLines.map((li) => {
        const line = FANO_LINES[li];
        const mid = {
          x: (FANO_POINTS[line[0]].x + FANO_POINTS[line[1]].x + FANO_POINTS[line[2]].x) / 3,
          y: (FANO_POINTS[line[0]].y + FANO_POINTS[line[1]].y + FANO_POINTS[line[2]].y) / 3,
        };
        const dx = mid.x - FANO_CIRCLE.cx,
          dy = mid.y - FANO_CIRCLE.cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ox = mid.x + (dx / dist) * 32,
          oy = mid.y + (dy / dist) * 32;
        const cat = FANO_LINE_CATEGORIES[li];
        const labelColor = cat === "primary" ? "#80a0ff" : cat === "complement" ? "#ffa060" : "#60ffa0";
        const mixLabel = `${COLOR_NAMES[line[0]]} + ${COLOR_NAMES[line[1]]} = ${COLOR_NAMES[line[2]]}`;
        return (
          <g key={"eq" + li}>
            <text
              x={ox}
              y={oy - 6}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={FS.sm}
              fontFamily="monospace"
              fill={labelColor}
              fontWeight={FW.bold}
            >
              {t("theory_fano_xor", String(line[0]), String(line[1]), String(line[2]))}
            </text>
            <text
              x={ox}
              y={oy + 6}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={FS.xs}
              fontFamily="monospace"
              fill={labelColor}
              opacity={0.8}
            >
              {mixLabel}
            </text>
          </g>
        );
      })}

      {/* Points */}
      {[1, 2, 3, 4, 5, 6, 7].map((lv) => {
        const p = FANO_POINTS[lv];
        const info = THEORY_LEVELS[lv];
        const active = hlPoints.has(lv);
        const dim = hl !== null && !active;
        return (
          <g
            key={"fp" + lv}
            onMouseEnter={() => onEnter(lv)}
            onMouseLeave={onLeave}
            onClick={() => onTap(lv)}
            style={{ cursor: "pointer" }}
          >
            <circle cx={p.x} cy={p.y} r={DOT_R + 6} fill="transparent" />
            {active && <circle cx={p.x} cy={p.y} r={DOT_R + 4} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />}
            <circle
              cx={p.x}
              cy={p.y}
              r={DOT_R}
              fill={info.color}
              fillOpacity={dim ? 0.2 : 0.85}
              stroke={dim ? info.color : "#fff"}
              strokeWidth={active ? 2.5 : 1.5}
              strokeOpacity={dim ? 0.3 : 0.8}
            />
            <text
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={FS.xl}
              fontWeight={900}
              fontFamily="monospace"
              fill={lv >= 4 ? "#000" : "#fff"}
              opacity={dim ? 0.3 : 1}
            >
              {lv}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {[
        { label: t("theory_fano_primary"), color: "#80a0ff" },
        { label: t("theory_fano_complement"), color: "#ffa060" },
        { label: t("theory_fano_secondary"), color: "#60ffa0" },
      ].map((item, i) => (
        <g key={"lg" + i}>
          <line x1={20} y1={H - 42 + i * 14} x2={34} y2={H - 42 + i * 14} stroke={item.color} strokeWidth={2} />
          <text x={40} y={H - 42 + i * 14} dominantBaseline="central" fontSize={FS.xs} fill={item.color} fontFamily="monospace">
            {item.label}
          </text>
        </g>
      ))}
    </svg>
  );
});
