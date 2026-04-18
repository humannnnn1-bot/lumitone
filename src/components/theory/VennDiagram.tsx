import React, { useCallback, useState } from "react";
import { FS, FW, SP } from "../../tokens";
import { usePinReset } from "./pin-reset";
import { useTranslation } from "../../i18n";

const W = 300;
const H = 260;
const RAD = 60;

// 3 circles in equilateral arrangement: R on top, G bottom-right, B bottom-left.
// Hue-wheel consistent: clockwise R → (R∩G=Y) → G → (G∩B=C) → B → (R∩B=M) → R.
const R_CENTER = { x: 150, y: 113 };
const G_CENTER = { x: 182, y: 168 };
const B_CENTER = { x: 118, y: 168 };

interface RegionInfo {
  lv: number;
  x: number;
  y: number;
  setLabel: string;
}

// Label positions pre-computed to fall within the corresponding region's interior.
const REGIONS: RegionInfo[] = [
  { lv: 0, x: 40, y: 32, setLabel: "\u2205" },
  { lv: 2, x: 150, y: 82, setLabel: "{R}" },
  { lv: 4, x: 212, y: 185, setLabel: "{G}" },
  { lv: 1, x: 88, y: 185, setLabel: "{B}" },
  { lv: 6, x: 177, y: 135, setLabel: "{R,G}" },
  { lv: 3, x: 123, y: 135, setLabel: "{R,B}" },
  { lv: 5, x: 150, y: 188, setLabel: "{G,B}" },
  { lv: 7, x: 150, y: 150, setLabel: "{R,G,B}" },
];

function regionOf(x: number, y: number): number {
  const r2 = RAD * RAD;
  const inR = (x - R_CENTER.x) ** 2 + (y - R_CENTER.y) ** 2 < r2 ? 2 : 0;
  const inG = (x - G_CENTER.x) ** 2 + (y - G_CENTER.y) ** 2 < r2 ? 4 : 0;
  const inB = (x - B_CENTER.x) ** 2 + (y - B_CENTER.y) ** 2 < r2 ? 1 : 0;
  return inG + inR + inB;
}

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const VennDiagram = React.memo(function VennDiagram({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<number | null>(null);
  usePinReset(setPinned);

  const enter = useCallback((lv: number) => onHover(lv), [onHover]);
  const leave = useCallback(() => onHover(null), [onHover]);

  const svgCoords = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const { x, y } = svgCoords(e);
      enter(regionOf(x, y));
    },
    [enter],
  );

  const onTap = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const { x, y } = svgCoords(e);
      const lv = regionOf(x, y);
      setPinned((prev) => {
        const next = prev === lv ? null : lv;
        queueMicrotask(() => onHover(next));
        return next;
      });
    },
    [onHover],
  );

  const hl = hlLevel !== null && hlLevel >= 0 && hlLevel <= 7 ? hlLevel : pinned;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", maxWidth: W, cursor: "pointer" }}
        role="img"
        aria-label={t("theory_venn_title")}
        onMouseMove={onMove}
        onMouseLeave={leave}
        onClick={onTap}
      >
        {/* 3 additive circles with screen blend — produces exact GF(2)³ colors at overlaps */}
        <g style={{ isolation: "isolate" }}>
          <circle cx={R_CENTER.x} cy={R_CENTER.y} r={RAD} fill="#ff0000" style={{ mixBlendMode: "screen" }} />
          <circle cx={G_CENTER.x} cy={G_CENTER.y} r={RAD} fill="#00ff00" style={{ mixBlendMode: "screen" }} />
          <circle cx={B_CENTER.x} cy={B_CENTER.y} r={RAD} fill="#0000ff" style={{ mixBlendMode: "screen" }} />
        </g>

        {/* Circle outlines */}
        {[
          { c: R_CENTER, color: "#ff4040" },
          { c: G_CENTER, color: "#40ff40" },
          { c: B_CENTER, color: "#4060ff" },
        ].map(({ c, color }, i) => (
          <circle key={`out${i}`} cx={c.x} cy={c.y} r={RAD} fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={1} />
        ))}

        {/* Outer bounds indicator for ∅ region when active */}
        {hl === 0 && (
          <rect
            x={2}
            y={2}
            width={W - 4}
            height={H - 4}
            fill="none"
            stroke="#fff"
            strokeOpacity={0.6}
            strokeDasharray="5,3"
            strokeWidth={1}
            pointerEvents="none"
          />
        )}

        {/* Region labels (set notation) */}
        {REGIONS.map(({ lv, x, y, setLabel }) => {
          const dim = hl !== null && hl !== lv;
          const textColor = lv >= 4 ? "#000" : "#fff";
          return (
            <g key={`r${lv}`} opacity={dim ? 0.3 : 1} pointerEvents="none" data-testid={`venn-region-${lv}`}>
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.sm}
                fontWeight={FW.bold}
                fontFamily="monospace"
                fill={textColor}
              >
                {setLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
});
