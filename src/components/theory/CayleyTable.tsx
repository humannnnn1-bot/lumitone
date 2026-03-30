import React, { useState, useCallback } from "react";
import { THEORY_LEVELS } from "./theory-data";
import { C, FS, FW } from "../../tokens";
import { useTranslation } from "../../i18n";

const CELL = 40;
const HDR = 36;
const GAP = 1;
const DOT_R = 12;
const N = 8;
const SVG_W = HDR + N * (CELL + GAP);
const SVG_H = HDR + N * (CELL + GAP);

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const CayleyTable = React.memo(function CayleyTable({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [hoverCell, setHoverCell] = useState<{ r: number; c: number } | null>(null);

  const onCellEnter = useCallback(
    (r: number, c: number) => {
      setHoverCell({ r, c });
      onHover(r ^ c);
    },
    [onHover],
  );
  const onCellLeave = useCallback(() => {
    setHoverCell(null);
    onHover(null);
  }, [onHover]);

  // External highlight: find cells whose result matches hlLevel
  const hlResult = hlLevel !== null && hlLevel >= 0 && hlLevel <= 7 ? hlLevel : null;

  const cellX = (col: number) => HDR + col * (CELL + GAP);
  const cellY = (row: number) => HDR + row * (CELL + GAP);

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: "100%", maxWidth: SVG_W }} role="img" aria-label={t("theory_xor_cayley_aria")}>
      {/* XOR symbol in corner */}
      <text
        x={HDR / 2}
        y={HDR / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={FS.lg}
        fontFamily="monospace"
        fontWeight={FW.bold}
        fill={C.textMuted}
      >
        {"\u2295"}
      </text>

      {/* Column headers */}
      {THEORY_LEVELS.map((lv, ci) => {
        const x = cellX(ci) + CELL / 2;
        const isHlCol = hoverCell?.c === ci;
        return (
          <g key={"ch" + ci}>
            <circle
              cx={x}
              cy={HDR / 2}
              r={DOT_R}
              fill={lv.lv === 0 ? C.bgRoot : lv.color}
              fillOpacity={isHlCol ? 0.9 : 0.6}
              stroke={isHlCol ? "#fff" : lv.color}
              strokeWidth={isHlCol ? 2 : 1}
            />
            <text
              x={x}
              y={HDR / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={FS.sm}
              fontWeight={FW.bold}
              fontFamily="monospace"
              fill={lv.lv >= 4 ? "#000" : "#fff"}
            >
              {lv.lv}
            </text>
          </g>
        );
      })}

      {/* Row headers */}
      {THEORY_LEVELS.map((lv, ri) => {
        const y = cellY(ri) + CELL / 2;
        const isHlRow = hoverCell?.r === ri;
        return (
          <g key={"rh" + ri}>
            <circle
              cx={HDR / 2}
              cy={y}
              r={DOT_R}
              fill={lv.lv === 0 ? C.bgRoot : lv.color}
              fillOpacity={isHlRow ? 0.9 : 0.6}
              stroke={isHlRow ? "#fff" : lv.color}
              strokeWidth={isHlRow ? 2 : 1}
            />
            <text
              x={HDR / 2}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={FS.sm}
              fontWeight={FW.bold}
              fontFamily="monospace"
              fill={lv.lv >= 4 ? "#000" : "#fff"}
            >
              {lv.lv}
            </text>
          </g>
        );
      })}

      {/* Cells */}
      {THEORY_LEVELS.map((_, ri) =>
        THEORY_LEVELS.map((__, ci) => {
          const result = ri ^ ci;
          const info = THEORY_LEVELS[result];
          const x = cellX(ci);
          const y = cellY(ri);
          const cx = x + CELL / 2;
          const cy = y + CELL / 2;

          const isHoverRow = hoverCell?.r === ri;
          const isHoverCol = hoverCell?.c === ci;
          const isHoverCell = isHoverRow && isHoverCol;
          const isRowOrCol = isHoverRow || isHoverCol;
          const isDiag = ri === ci; // a⊕a=0
          const isHlMatch = hlResult !== null && result === hlResult;

          // Dim cells not in the hovered row/col
          const anyHover = hoverCell !== null;
          const anyHl = hlResult !== null;
          const dim = (anyHover && !isRowOrCol) || (anyHl && !anyHover && !isHlMatch);

          const bgOpacity = isHoverCell ? 0.25 : isRowOrCol ? 0.1 : isDiag ? 0.04 : 0.03;

          const dotOpacity = dim ? 0.12 : isHoverCell ? 1 : isRowOrCol || isHlMatch ? 0.85 : 0.55;
          const dotR = isHoverCell ? DOT_R + 2 : DOT_R - 2;

          return (
            <g key={`c${ri}_${ci}`} onMouseEnter={() => onCellEnter(ri, ci)} onMouseLeave={onCellLeave} style={{ cursor: "pointer" }}>
              {/* Cell background */}
              <rect
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={3}
                fill={isDiag ? "rgba(255,255,255,0.03)" : info.color}
                fillOpacity={bgOpacity}
                stroke={isHoverCell ? "rgba(255,255,255,0.5)" : isDiag ? "rgba(255,255,255,0.06)" : "transparent"}
                strokeWidth={isHoverCell ? 1.5 : 0.5}
              />
              {/* Result dot */}
              <circle
                cx={cx}
                cy={cy}
                r={dotR}
                fill={result === 0 ? C.bgRoot : info.color}
                fillOpacity={dotOpacity}
                stroke={result === 0 ? C.textDimmer : info.color}
                strokeWidth={result === 0 ? 0.8 : 0}
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={isHoverCell ? FS.md : FS.xs}
                fontWeight={FW.bold}
                fontFamily="monospace"
                fill={result === 0 ? C.textDimmer : result >= 4 ? "#000" : "#fff"}
                opacity={dotOpacity}
              >
                {result}
              </text>
            </g>
          );
        }),
      )}

      {/* Hover info: equation at bottom */}
      {hoverCell && (
        <text x={SVG_W / 2} y={SVG_H - 4} textAnchor="middle" fontSize={FS.sm} fontFamily="monospace" fill={C.textMuted}>
          {THEORY_LEVELS[hoverCell.r].name} ({hoverCell.r}) {"\u2295"} {THEORY_LEVELS[hoverCell.c].name} ({hoverCell.c}) ={" "}
          {THEORY_LEVELS[hoverCell.r ^ hoverCell.c].name} ({hoverCell.r ^ hoverCell.c})
        </text>
      )}
    </svg>
  );
});
