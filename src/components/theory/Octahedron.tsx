import React, { useState, useCallback } from "react";
import { THEORY_LEVELS, OCTA_POINTS, OCTA_EDGES, OCTA_FACES, OCTA_COMPLEMENT_AXES } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { S_BTN } from "../../styles";
import { usePinReset } from "./pin-reset";
import { useTranslation } from "../../i18n";

const W = 300,
  H = 300;
const DOT_R = 13;
const CY = 150;

/* ── z-ordering helpers ── */

/** Cross product of 2D vectors (p1-p0) × (p2-p0) — positive = CCW in SVG coords */
function crossZ(p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
}

/** Sort faces back-to-front: faces with negative cross product (CW winding in SVG) are back-facing */
function sortedFaces() {
  return [...OCTA_FACES].sort((a, b) => {
    const cA = crossZ(OCTA_POINTS[a.verts[0]], OCTA_POINTS[a.verts[1]], OCTA_POINTS[a.verts[2]]);
    const cB = crossZ(OCTA_POINTS[b.verts[0]], OCTA_POINTS[b.verts[1]], OCTA_POINTS[b.verts[2]]);
    return cA - cB; // negative (back) first, positive (front) last
  });
}

const SORTED_FACES = sortedFaces();

/** Centroid of a triangle */
function centroid(verts: readonly [number, number, number]): { x: number; y: number } {
  const p0 = OCTA_POINTS[verts[0]],
    p1 = OCTA_POINTS[verts[1]],
    p2 = OCTA_POINTS[verts[2]];
  return { x: (p0.x + p1.x + p2.x) / 3, y: (p0.y + p1.y + p2.y) / 3 };
}

function isFrontFace(f: (typeof OCTA_FACES)[number]): boolean {
  return crossZ(OCTA_POINTS[f.verts[0]], OCTA_POINTS[f.verts[1]], OCTA_POINTS[f.verts[2]]) > 0;
}

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const Octahedron = React.memo(function Octahedron({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<number | null>(null);
  usePinReset(setPinned);
  const [showAxes, setShowAxes] = useState(false);
  const [hlFace, setHlFace] = useState<number | null>(null);

  const hl = hlLevel !== null && hlLevel >= 1 && hlLevel <= 6 ? hlLevel : pinned;

  // Edges adjacent to highlighted vertex
  const hlEdgeSet = new Set<number>();
  // Faces adjacent to highlighted vertex
  const hlFaceSet = new Set<number>();
  // Complement partner
  let complementLv: number | null = null;

  if (hl !== null) {
    OCTA_EDGES.forEach(([a, b], ei) => {
      if (a === hl || b === hl) hlEdgeSet.add(ei);
    });
    OCTA_FACES.forEach((f, fi) => {
      if (f.verts.includes(hl as 1 | 2 | 3 | 4 | 5 | 6)) hlFaceSet.add(fi);
    });
    complementLv = hl ^ 7;
  }

  const onEnter = useCallback((lv: number) => onHover(lv), [onHover]);
  const onLeave = useCallback(() => onHover(null), [onHover]);
  const onTap = useCallback(
    (lv: number) => {
      setPinned((prev) => {
        const next = prev === lv ? null : lv;
        queueMicrotask(() => onHover(next));
        return next;
      });
    },
    [onHover],
  );

  const anyHl = hl !== null || hlFace !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg, width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }} role="img" aria-label={t("theory_octa_title")}>
        {/* Faces — sorted back to front */}
        {SORTED_FACES.map((f, fi) => {
          const isFront = isFrontFace(f);
          const faceActive = hlFace === f.color || hlFaceSet.has(OCTA_FACES.indexOf(f));
          const faceDim = anyHl && !faceActive;
          const info = THEORY_LEVELS[f.color];
          const pts = f.verts.map((v) => `${OCTA_POINTS[v].x},${OCTA_POINTS[v].y}`).join(" ");
          const ctr = centroid(f.verts);

          return (
            <g
              key={`face-${fi}`}
              onMouseEnter={() => setHlFace(f.color)}
              onMouseLeave={() => setHlFace(null)}
              style={{ cursor: "default" }}
            >
              {/* Invisible hit area */}
              <polygon points={pts} fill="transparent" />
              {/* Visible face */}
              <polygon
                points={pts}
                fill={info.color}
                fillOpacity={faceActive ? 0.35 : faceDim ? 0.04 : isFront ? 0.15 : 0.06}
                stroke={info.color}
                strokeWidth={faceActive ? 1.5 : 0.5}
                strokeOpacity={faceActive ? 0.8 : faceDim ? 0.08 : isFront ? 0.3 : 0.12}
                strokeLinejoin="round"
              />
              {/* Face label on hover */}
              {hlFace === f.color && (
                <text
                  x={ctr.x}
                  y={ctr.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={FS.xs}
                  fontFamily="monospace"
                  fontWeight={FW.bold}
                  fill={f.color === 0 || f.color === 1 ? "#fff" : info.color}
                  opacity={0.9}
                >
                  {info.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Edges */}
        {OCTA_EDGES.map(([a, b], ei) => {
          const active = hlEdgeSet.has(ei);
          const dim = anyHl && !active;
          return (
            <line
              key={`e-${ei}`}
              x1={OCTA_POINTS[a].x}
              y1={OCTA_POINTS[a].y}
              x2={OCTA_POINTS[b].x}
              y2={OCTA_POINTS[b].y}
              stroke={active ? "#fff" : C.textDimmer}
              strokeWidth={active ? 1.8 : 0.8}
              opacity={dim ? 0.12 : active ? 0.85 : 0.35}
            />
          );
        })}

        {/* Complement axes (optional) */}
        {showAxes &&
          OCTA_COMPLEMENT_AXES.map(([a, b]) => {
            const pa = OCTA_POINTS[a],
              pb = OCTA_POINTS[b];
            const mx = (pa.x + pb.x) / 2,
              my = (pa.y + pb.y) / 2;
            return (
              <g key={`ax-${a}-${b}`}>
                <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="rgba(255,255,255,0.25)" strokeWidth={1} strokeDasharray="4 3" />
                <text
                  x={mx + (a === 4 ? 16 : a === 1 ? -16 : 0)}
                  y={my + (a === 2 ? -14 : a === 4 ? 10 : 14)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={FS.xxs}
                  fontFamily="monospace"
                  fill="rgba(255,255,255,0.4)"
                >
                  {THEORY_LEVELS[a].name[0]}\u2194{THEORY_LEVELS[b].name[0]}
                </text>
              </g>
            );
          })}

        {/* Vertices */}
        {[2, 5, 4, 3, 1, 6].map((lv) => {
          const p = OCTA_POINTS[lv];
          const info = THEORY_LEVELS[lv];
          const active = hl === lv || complementLv === lv;
          const dim = anyHl && !active && !hlFaceSet.has(-1); // dim only when something is highlighted
          const isComplement = complementLv === lv;

          return (
            <g
              key={`v-${lv}`}
              onMouseEnter={() => onEnter(lv)}
              onMouseLeave={onLeave}
              onClick={() => onTap(lv)}
              style={{ cursor: "pointer" }}
            >
              {/* Larger hit area */}
              <circle cx={p.x} cy={p.y} r={DOT_R + 6} fill="transparent" />
              {/* Vertex circle */}
              <circle
                cx={p.x}
                cy={p.y}
                r={DOT_R}
                fill={info.color}
                fillOpacity={active ? 0.5 : dim ? 0.08 : 0.3}
                stroke={isComplement ? "#fff" : active ? "#fff" : info.color}
                strokeWidth={active ? 2 : 1.2}
                strokeOpacity={dim ? 0.15 : 0.7}
                strokeDasharray={isComplement ? "3 2" : "none"}
              />
              {/* Level number */}
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.md}
                fontFamily="monospace"
                fontWeight={FW.bold}
                fill={lv === 6 ? "#000" : "#fff"}
                opacity={dim ? 0.2 : 0.9}
              >
                {lv}
              </text>
              {/* Color name below/above vertex */}
              <text
                x={p.x}
                y={p.y + (p.y < CY ? -DOT_R - 5 : DOT_R + 8)}
                textAnchor="middle"
                dominantBaseline={p.y < CY ? "auto" : "hanging"}
                fontSize={FS.xxs}
                fontFamily="monospace"
                fill={info.color}
                opacity={dim ? 0.15 : 0.7}
              >
                {info.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Toggle buttons */}
      <div style={{ display: "flex", gap: SP.md, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          style={{
            ...S_BTN,
            borderColor: showAxes ? C.accentBright : C.border,
            color: showAxes ? C.accentBright : C.textMuted,
          }}
          onClick={() => setShowAxes((v) => !v)}
        >
          {t("theory_octa_axes")}
        </button>
      </div>
    </div>
  );
});
