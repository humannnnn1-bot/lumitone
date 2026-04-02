import React, { useState, useCallback } from "react";
import { THEORY_LEVELS, CUBOCTA_VERTICES, CUBOCTA_EDGES, CUBOCTA_TRI_FACES, CUBOCTA_SQ_FACES } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { S_BTN } from "../../styles";
import { usePinReset } from "./pin-reset";
import { useTranslation } from "../../i18n";

const W = 300,
  H = 300;
const DOT_R = 8;

/* ── z-ordering helpers ── */

/** Cross product of 2D vectors (p1-p0) x (p2-p0) */
function crossZ(p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
}

/** Sort triangle faces back-to-front for painter's algorithm */
function sortedTriFaces() {
  return [...CUBOCTA_TRI_FACES].sort((a, b) => {
    const ptsA = a.verts.map((vi) => CUBOCTA_VERTICES[vi]);
    const ptsB = b.verts.map((vi) => CUBOCTA_VERTICES[vi]);
    const cA = crossZ(ptsA[0], ptsA[1], ptsA[2]);
    const cB = crossZ(ptsB[0], ptsB[1], ptsB[2]);
    return cA - cB; // negative (back) first
  });
}

const SORTED_TRI_FACES = sortedTriFaces();

/** Sort square faces by average y (depth) — lower y = further back in isometric */
function sortedSqFaces() {
  return [...CUBOCTA_SQ_FACES].sort((a, b) => {
    const avgYa = a.verts.reduce((s, vi) => s + CUBOCTA_VERTICES[vi].y, 0) / a.verts.length;
    const avgYb = b.verts.reduce((s, vi) => s + CUBOCTA_VERTICES[vi].y, 0) / b.verts.length;
    return avgYa - avgYb;
  });
}

const SORTED_SQ_FACES = sortedSqFaces();

/** Sort polygon vertices by angle from centroid to avoid crossed edges */
function sortVertsByAngle(vertIdxs: number[]): number[] {
  const cx = vertIdxs.reduce((s, vi) => s + CUBOCTA_VERTICES[vi].x, 0) / vertIdxs.length;
  const cy = vertIdxs.reduce((s, vi) => s + CUBOCTA_VERTICES[vi].y, 0) / vertIdxs.length;
  return [...vertIdxs].sort((a, b) => {
    const angA = Math.atan2(CUBOCTA_VERTICES[a].y - cy, CUBOCTA_VERTICES[a].x - cx);
    const angB = Math.atan2(CUBOCTA_VERTICES[b].y - cy, CUBOCTA_VERTICES[b].x - cx);
    return angA - angB;
  });
}

/** Square face tint color based on axis and value */
function sqFaceColor(axis: "G" | "R" | "B", value: 0 | 1): string {
  if (axis === "G") return value === 1 ? "rgba(0,255,0,0.12)" : "rgba(0,255,0,0.06)";
  if (axis === "R") return value === 1 ? "rgba(255,0,0,0.12)" : "rgba(255,0,0,0.06)";
  return value === 1 ? "rgba(0,0,255,0.12)" : "rgba(0,0,255,0.06)";
}

function sqFaceStroke(axis: "G" | "R" | "B"): string {
  if (axis === "G") return "rgba(0,255,0,0.3)";
  if (axis === "R") return "rgba(255,0,0,0.3)";
  return "rgba(0,0,255,0.3)";
}

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const Cuboctahedron = React.memo(function Cuboctahedron({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<number | null>(null);
  usePinReset(setPinned);
  const [showFaces, setShowFaces] = useState(false);
  const [hlVertex, setHlVertex] = useState<number | null>(null);

  const hl = hlLevel !== null && hlLevel >= 0 && hlLevel <= 7 ? hlLevel : pinned;

  // Find cuboctahedron vertices adjacent to a highlighted cube level
  const hlVertSet = new Set<number>();
  if (hl !== null) {
    CUBOCTA_VERTICES.forEach((v, vi) => {
      if (v.lv0 === hl || v.lv1 === hl) hlVertSet.add(vi);
    });
  }

  // Edges adjacent to highlighted cuboctahedron vertex
  const hlEdgeSet = new Set<number>();
  if (hlVertex !== null) {
    CUBOCTA_EDGES.forEach(([a, b], ei) => {
      if (a === hlVertex || b === hlVertex) hlEdgeSet.add(ei);
    });
  }

  const anyHl = hl !== null || hlVertex !== null;

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

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg, width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }} role="img" aria-label={t("theory_cubocta_title")}>
        {/* Square faces (when toggled on) */}
        {showFaces &&
          SORTED_SQ_FACES.map((f, fi) => {
            const sorted = sortVertsByAngle(f.verts);
            const pts = sorted.map((vi) => `${CUBOCTA_VERTICES[vi].x},${CUBOCTA_VERTICES[vi].y}`).join(" ");
            return (
              <polygon
                key={`sq-${fi}`}
                points={pts}
                fill={sqFaceColor(f.axis, f.value)}
                stroke={sqFaceStroke(f.axis)}
                strokeWidth={0.5}
                strokeLinejoin="round"
              />
            );
          })}

        {/* Triangular faces (when toggled on) — sorted back to front */}
        {showFaces &&
          SORTED_TRI_FACES.map((f, fi) => {
            const info = THEORY_LEVELS[f.color];
            const pts = f.verts.map((vi) => `${CUBOCTA_VERTICES[vi].x},${CUBOCTA_VERTICES[vi].y}`).join(" ");
            const isHl = hl === f.color;
            return (
              <polygon
                key={`tri-${fi}`}
                points={pts}
                fill={info.color}
                fillOpacity={isHl ? 0.35 : 0.12}
                stroke={info.color}
                strokeWidth={isHl ? 1.5 : 0.5}
                strokeOpacity={isHl ? 0.8 : 0.2}
                strokeLinejoin="round"
              />
            );
          })}

        {/* Edges */}
        {CUBOCTA_EDGES.map(([a, b], ei) => {
          const va = CUBOCTA_VERTICES[a],
            vb = CUBOCTA_VERTICES[b];
          const active = hlEdgeSet.has(ei);
          const adjToHl = hlVertSet.has(a) || hlVertSet.has(b);
          const dim = anyHl && !active && !adjToHl;
          return (
            <line
              key={`e-${ei}`}
              x1={va.x}
              y1={va.y}
              x2={vb.x}
              y2={vb.y}
              stroke={active ? "#fff" : "rgba(255,255,255,0.25)"}
              strokeWidth={active ? 1.5 : 0.8}
              opacity={dim ? 0.12 : active ? 0.85 : 0.5}
            />
          );
        })}

        {/* Vertices */}
        {CUBOCTA_VERTICES.map((v, vi) => {
          const adjToHl = hlVertSet.has(vi);
          const isHovered = hlVertex === vi;
          const dim = anyHl && !adjToHl && !isHovered;
          const lv0Info = THEORY_LEVELS[v.lv0];
          const lv1Info = THEORY_LEVELS[v.lv1];

          return (
            <g
              key={`v-${vi}`}
              onMouseEnter={() => {
                setHlVertex(vi);
                // Hover both source cube levels — pick the first one for the shared onHover
                onEnter(v.lv0);
              }}
              onMouseLeave={() => {
                setHlVertex(null);
                onLeave();
              }}
              onClick={() => onTap(v.lv0)}
              style={{ cursor: "pointer" }}
            >
              {/* Larger hit area */}
              <circle cx={v.x} cy={v.y} r={DOT_R + 6} fill="transparent" />
              {/* Vertex circle */}
              <circle
                cx={v.x}
                cy={v.y}
                r={DOT_R}
                fill={v.midColor}
                fillOpacity={adjToHl || isHovered ? 0.9 : dim ? 0.15 : 0.7}
                stroke={adjToHl || isHovered ? "#fff" : v.midColor}
                strokeWidth={isHovered ? 2 : adjToHl ? 1.8 : 1}
                strokeOpacity={dim ? 0.15 : 0.7}
              />
              {/* Source level labels on hover */}
              {isHovered && (
                <>
                  <text
                    x={v.x - DOT_R - 4}
                    y={v.y - DOT_R - 4}
                    textAnchor="end"
                    dominantBaseline="auto"
                    fontSize={FS.xs}
                    fontFamily="monospace"
                    fontWeight={FW.bold}
                    fill={lv0Info.color}
                    opacity={0.9}
                  >
                    {v.lv0}
                  </text>
                  <text
                    x={v.x + DOT_R + 4}
                    y={v.y - DOT_R - 4}
                    textAnchor="start"
                    dominantBaseline="auto"
                    fontSize={FS.xs}
                    fontFamily="monospace"
                    fontWeight={FW.bold}
                    fill={lv1Info.color}
                    opacity={0.9}
                  >
                    {v.lv1}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Toggle buttons */}
      <div style={{ display: "flex", gap: SP.md, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          style={{
            ...S_BTN,
            borderColor: showFaces ? C.accentBright : C.border,
            color: showFaces ? C.accentBright : C.textMuted,
          }}
          onClick={() => setShowFaces((v) => !v)}
        >
          {t("theory_cubocta_faces")}
        </button>
      </div>
    </div>
  );
});
