import React, { useState, useCallback } from "react";
import { THEORY_LEVELS, CUBE_EDGES, CUBE_POINTS, CUBE_POINTS_WHITE, edgeChannel, isBackEdge, isBackEdgeWhite } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { useTranslation } from "../../i18n";

const W = 180;
const H = 180;
const DOT_R = 11;
const SCALE = 50;
const CHANNEL_COLORS: Record<string, string> = { G: "#00ff00", R: "#ff0000", B: "#0000ff" };

// Rescale cube points to fit the smaller viewBox
function rescale(
  pts: Record<number, { x: number; y: number }>,
  origCx: number,
  origCy: number,
  newCx: number,
  newCy: number,
  scale: number,
): Record<number, { x: number; y: number }> {
  const out: Record<number, { x: number; y: number }> = {};
  for (let i = 0; i < 8; i++) {
    const p = pts[i];
    out[i] = {
      x: newCx + ((p.x - origCx) / 70) * scale,
      y: newCy + ((p.y - origCy) / 140) * scale * (140 / 70),
    };
  }
  return out;
}

const CX = W / 2;
const CY = H / 2 + 5;
const BLACK_PTS = rescale(CUBE_POINTS, 150, 140, CX, CY, SCALE);
const WHITE_PTS = rescale(CUBE_POINTS_WHITE, 150, 140, CX, CY, SCALE);

// Primaries and secondaries
const PRIMARIES = [1, 2, 4] as const;
const SECONDARIES = [3, 5, 6] as const;

// Which bit each secondary absorbs: M(3)=011 absorbs G(4), C(5)=101 absorbs R(2), Y(6)=110 absorbs B(1)
const ABSORBS: Record<number, number> = { 3: 4, 5: 2, 6: 1 };
const PNAME: Record<number, string> = { 1: "B", 2: "R", 4: "G" };
const SNAME: Record<number, string> = { 3: "M", 5: "C", 6: "Y" };

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

function PolarCubeView({
  pole,
  mask,
  onToggle,
  hlLevel,
  onHover,
}: {
  pole: "black" | "white";
  mask: number;
  onToggle: (bit: number) => void;
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}) {
  const pts = pole === "black" ? BLACK_PTS : WHITE_PTS;
  const backTest = pole === "black" ? isBackEdge : isBackEdgeWhite;
  const operators = pole === "black" ? PRIMARIES : SECONDARIES;
  const result = pole === "black" ? mask : 7 ^ mask;
  const poleVertex = pole === "black" ? 0 : 7;

  const handleClick = (lv: number) => {
    if (pole === "black" && (lv === 1 || lv === 2 || lv === 4)) {
      onToggle(lv);
    } else if (pole === "white" && (lv === 3 || lv === 5 || lv === 6)) {
      onToggle(ABSORBS[lv]);
    }
  };

  const isSelected = (lv: number): boolean => {
    if (pole === "black") return (lv === 1 || lv === 2 || lv === 4) && (mask & lv) !== 0;
    if (pole === "white") return (lv === 3 || lv === 5 || lv === 6) && (mask & ABSORBS[lv]) !== 0;
    return false;
  };

  const isOperator = (lv: number) => (operators as readonly number[]).includes(lv);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }}>
      {/* Edges */}
      {CUBE_EDGES.map((e, ei) => {
        const p0 = pts[e[0]];
        const p1 = pts[e[1]];
        const back = backTest(e[0], e[1]);
        const ch = edgeChannel(e[0], e[1]);
        const chColor = CHANNEL_COLORS[ch];
        const isResultEdge = (e[0] === result || e[1] === result) && !back;
        return (
          <line
            key={"pe" + ei}
            x1={p0.x}
            y1={p0.y}
            x2={p1.x}
            y2={p1.y}
            stroke={isResultEdge ? chColor : C.textDimmer}
            strokeWidth={isResultEdge ? 1.5 : 0.8}
            strokeDasharray={back ? "3,3" : undefined}
            opacity={back ? 0.15 : isResultEdge ? 0.7 : 0.25}
          />
        );
      })}

      {/* Vertices */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((lv) => {
        const p = pts[lv];
        const info = THEORY_LEVELS[lv];
        const isPole = lv === poleVertex;
        const sel = isSelected(lv);
        const isOp = isOperator(lv);
        const isResult = lv === result && mask > 0;
        const isHl = hlLevel === lv;
        const vertOpacity = isPole ? 0.2 : lv === 7 - poleVertex ? 0.5 : 1;

        return (
          <g
            key={"pv" + lv}
            onMouseEnter={() => onHover(lv)}
            onMouseLeave={() => onHover(null)}
            onClick={() => handleClick(lv)}
            style={{ cursor: isOp ? "pointer" : "default" }}
            opacity={vertOpacity}
          >
            <circle cx={p.x} cy={p.y} r={DOT_R + 6} fill="transparent" />
            {/* Selection ring */}
            {sel && <circle cx={p.x} cy={p.y} r={DOT_R + 4} fill="none" stroke={info.color} strokeWidth={2} opacity={0.7} />}
            {/* Result glow */}
            {isResult && <circle cx={p.x} cy={p.y} r={DOT_R + 5} fill="none" stroke="#fff" strokeWidth={2} opacity={0.6} />}
            {/* Hover ring */}
            {isHl && !sel && !isResult && (
              <circle cx={p.x} cy={p.y} r={DOT_R + 4} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
            )}
            {/* Dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={DOT_R}
              fill={lv === 0 ? C.bgRoot : info.color}
              fillOpacity={sel || isResult ? 0.9 : isOp ? 0.5 : 0.35}
              stroke={sel || isResult ? "#fff" : lv === 0 ? C.textDimmer : info.color}
              strokeWidth={sel || isResult ? 2 : 1}
              strokeOpacity={0.7}
            />
            {/* Number */}
            <text
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={FS.sm}
              fontWeight={900}
              fontFamily="monospace"
              fill={lv >= 4 ? "#000" : "#fff"}
              opacity={sel || isResult ? 1 : 0.7}
            >
              {lv}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export const PolarCubes = React.memo(function PolarCubes({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [mask, setMask] = useState(0);

  const toggle = useCallback((bit: number) => setMask((m) => m ^ bit), []);

  const additiveResult = mask;
  const subtractiveResult = 7 ^ mask;

  // Build equation strings
  const selectedPrimaries = ([4, 2, 1] as const).filter((b) => mask & b);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md }}>
      <div style={{ display: "flex", gap: SP.xl, justifyContent: "center", flexWrap: "wrap" }}>
        {/* Additive (Black pole) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.xs }}>
          <span style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer }}>{t("theory_polar_additive")}</span>
          <PolarCubeView pole="black" mask={mask} onToggle={toggle} hlLevel={hlLevel} onHover={onHover} />
        </div>
        {/* Subtractive (White pole) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.xs }}>
          <span style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer }}>{t("theory_polar_subtractive")}</span>
          <PolarCubeView pole="white" mask={mask} onToggle={toggle} hlLevel={hlLevel} onHover={onHover} />
        </div>
      </div>

      {/* Equations */}
      <div
        style={{ display: "flex", gap: SP["2xl"], justifyContent: "center", flexWrap: "wrap", fontSize: FS.sm, fontFamily: "monospace" }}
      >
        {/* Additive equation */}
        <span>
          {selectedPrimaries.length === 0 ? (
            <span style={{ color: C.textDimmer }}>0 (Black)</span>
          ) : (
            <>
              {selectedPrimaries.map((p, i) => (
                <React.Fragment key={p}>
                  {i > 0 && <span style={{ color: C.textDimmer }}> {"\u2295"} </span>}
                  <span style={{ color: THEORY_LEVELS[p].color, fontWeight: FW.bold }}>{PNAME[p]}</span>
                </React.Fragment>
              ))}
              <span style={{ color: C.textDimmer }}> = </span>
              <span style={{ color: THEORY_LEVELS[additiveResult].color, fontWeight: FW.bold }}>{THEORY_LEVELS[additiveResult].name}</span>
            </>
          )}
        </span>
        {/* Subtractive equation */}
        <span>
          {selectedPrimaries.length === 0 ? (
            <span style={{ color: C.textDimmer }}>7 (White)</span>
          ) : (
            <>
              {selectedPrimaries.map((p, i) => {
                const s = 7 ^ p;
                return (
                  <React.Fragment key={p}>
                    {i > 0 && <span style={{ color: C.textDimmer }}> {"\u2227"} </span>}
                    <span style={{ color: THEORY_LEVELS[s].color, fontWeight: FW.bold }}>{SNAME[s]}</span>
                  </React.Fragment>
                );
              })}
              <span style={{ color: C.textDimmer }}> = </span>
              <span style={{ color: THEORY_LEVELS[subtractiveResult].color, fontWeight: FW.bold }}>
                {THEORY_LEVELS[subtractiveResult].name}
              </span>
            </>
          )}
        </span>
      </div>

      {/* Hint */}
      <p style={{ fontSize: FS.xxs, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center" }}>
        {t("theory_polar_hint")}
      </p>
    </div>
  );
});
