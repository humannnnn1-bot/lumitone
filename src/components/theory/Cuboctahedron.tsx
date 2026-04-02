import React, { useState, useCallback } from "react";
import {
  THEORY_LEVELS,
  CUBOCTA_VERTICES,
  CUBOCTA_VERTICES_WHITE,
  CUBOCTA_EDGES,
  CUBOCTA_TRI_FACES,
  CUBOCTA_SQ_FACES,
  CuboctaVertex,
} from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { S_BTN } from "../../styles";
import { usePinReset } from "./pin-reset";
import { useTranslation } from "../../i18n";

const W = 200,
  H = 200;
const DOT_R = 6;

/* ── z-ordering & back-edge helpers ── */

function sortVertsByAngle(vertIdxs: number[], verts: CuboctaVertex[]): number[] {
  const cx = vertIdxs.reduce((s, vi) => s + verts[vi].x, 0) / vertIdxs.length;
  const cy = vertIdxs.reduce((s, vi) => s + verts[vi].y, 0) / vertIdxs.length;
  return [...vertIdxs].sort((a, b) => {
    const angA = Math.atan2(verts[a].y - cy, verts[a].x - cx);
    const angB = Math.atan2(verts[b].y - cy, verts[b].x - cx);
    return angA - angB;
  });
}

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

/** Compute back-edge set using bit-sum depth proxy */
function computeBackEdges(verts: CuboctaVertex[], isWhitePole: boolean): Set<number> {
  const bitSum = (v: number) => (v & 1) + ((v >> 1) & 1) + ((v >> 2) & 1);
  const vertDepth = verts.map((v) => (bitSum(v.lv0) + bitSum(v.lv1)) / 2);
  const depthThreshold = 1.5;

  const allFaces: number[][] = [...CUBOCTA_TRI_FACES.map((f) => f.verts), ...CUBOCTA_SQ_FACES.map((f) => f.verts)];
  const faceIsBack = allFaces.map((fverts) => {
    const avgDepth = fverts.reduce((s, vi) => s + vertDepth[vi], 0) / fverts.length;
    return isWhitePole ? avgDepth > depthThreshold : avgDepth < depthThreshold;
  });

  const backEdges = new Set<number>();
  CUBOCTA_EDGES.forEach(([a, b], ei) => {
    const adjFaces: number[] = [];
    for (let fi = 0; fi < allFaces.length; fi++) {
      if (allFaces[fi].includes(a) && allFaces[fi].includes(b)) {
        adjFaces.push(fi);
      }
    }
    if (adjFaces.length === 2 && faceIsBack[adjFaces[0]] && faceIsBack[adjFaces[1]]) {
      backEdges.add(ei);
    }
  });
  return backEdges;
}

const BACK_EDGES_BLACK = computeBackEdges(CUBOCTA_VERTICES, false);
const BACK_EDGES_WHITE = computeBackEdges(CUBOCTA_VERTICES_WHITE, true);

/** Normalized depth [0..1] for each cuboctahedron vertex (0 = back, 1 = front) */
const bitSum = (v: number) => (v & 1) + ((v >> 1) & 1) + ((v >> 2) & 1);
const VERT_DEPTH: number[] = CUBOCTA_VERTICES.map((v) => (bitSum(v.lv0) + bitSum(v.lv1)) / 2 / 3);
// White-pole: invert depth
const VERT_DEPTH_WHITE: number[] = VERT_DEPTH.map((d) => 1 - d);

/** Depth-based opacity: lerp between dim and bright */
function depthOpacity(depth: number, min: number, max: number): number {
  return min + depth * (max - min);
}

/** Sort tri faces back-to-front for a given vertex set */
function sortedTriFaces(verts: CuboctaVertex[]) {
  function crossZ(p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    return (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
  }
  return [...CUBOCTA_TRI_FACES].sort((a, b) => {
    const ptsA = a.verts.map((vi) => verts[vi]);
    const ptsB = b.verts.map((vi) => verts[vi]);
    return crossZ(ptsA[0], ptsA[1], ptsA[2]) - crossZ(ptsB[0], ptsB[1], ptsB[2]);
  });
}

function sortedSqFaces(verts: CuboctaVertex[]) {
  return [...CUBOCTA_SQ_FACES].sort((a, b) => {
    const avgYa = a.verts.reduce((s, vi) => s + verts[vi].y, 0) / a.verts.length;
    const avgYb = b.verts.reduce((s, vi) => s + verts[vi].y, 0) / b.verts.length;
    return avgYa - avgYb;
  });
}

const SORTED_TRI_BLACK = sortedTriFaces(CUBOCTA_VERTICES);
const SORTED_TRI_WHITE = sortedTriFaces(CUBOCTA_VERTICES_WHITE);
const SORTED_SQ_BLACK = sortedSqFaces(CUBOCTA_VERTICES);
const SORTED_SQ_WHITE = sortedSqFaces(CUBOCTA_VERTICES_WHITE);

/* ── Rescale to fit smaller viewBox ── */
const ORIG_CX = 150,
  ORIG_CY = 150;
const NEW_CX = W / 2,
  NEW_CY = H / 2;
const FIT_SCALE = (W - 40) / 200; // 200 = original span ~200px in 300×300

function rescaleVerts(verts: CuboctaVertex[]): CuboctaVertex[] {
  return verts.map((v) => ({
    ...v,
    x: NEW_CX + (v.x - ORIG_CX) * FIT_SCALE,
    y: NEW_CY + (v.y - ORIG_CY) * FIT_SCALE,
  }));
}

const VERTS_BLACK = rescaleVerts(CUBOCTA_VERTICES);
const VERTS_WHITE = rescaleVerts(CUBOCTA_VERTICES_WHITE);

/* ── Sub-component for one view ── */

interface ViewProps {
  verts: CuboctaVertex[];
  vertDepths: number[];
  sortedTri: { color: number; verts: number[] }[];
  sortedSq: { axis: "G" | "R" | "B"; value: 0 | 1; verts: number[] }[];
  backEdges: Set<number>;
  showFaces: boolean;
  hl: number | null;
  hlVertSet: Set<number>;
  hlVertex: number | null;
  hlEdgeSet: Set<number>;
  anyHl: boolean;
  onEnter: (lv: number) => void;
  onLeave: () => void;
  onTap: (lv: number) => void;
  setHlVertex: (v: number | null) => void;
  label: string;
}

function CuboctaView({
  verts,
  vertDepths,
  sortedTri,
  sortedSq,
  backEdges,
  showFaces,
  hl,
  hlVertSet,
  hlVertex,
  hlEdgeSet,
  anyHl,
  onEnter,
  onLeave,
  onTap,
  setHlVertex,
  label,
}: ViewProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.xs, flex: 1, minWidth: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }}>
        {/* Square faces */}
        {showFaces &&
          sortedSq.map((f, fi) => {
            const sorted = sortVertsByAngle(f.verts, verts);
            const pts = sorted.map((vi) => `${verts[vi].x},${verts[vi].y}`).join(" ");
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

        {/* Triangular faces */}
        {showFaces &&
          sortedTri.map((f, fi) => {
            const info = THEORY_LEVELS[f.color];
            const pts = f.verts.map((vi) => `${verts[vi].x},${verts[vi].y}`).join(" ");
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
          const va = verts[a],
            vb = verts[b];
          const active = hlEdgeSet.has(ei);
          const adjToHl = hlVertSet.has(a) || hlVertSet.has(b);
          const dim = anyHl && !active && !adjToHl;
          const back = backEdges.has(ei);
          const edgeDepth = (vertDepths[a] + vertDepths[b]) / 2;
          const baseOpacity = depthOpacity(edgeDepth, 0.15, 0.55);
          return (
            <line
              key={`e-${ei}`}
              x1={va.x}
              y1={va.y}
              x2={vb.x}
              y2={vb.y}
              stroke={active ? "#fff" : "rgba(255,255,255,0.25)"}
              strokeWidth={active ? 1.5 : 0.8}
              strokeDasharray={back && !active ? "3,3" : undefined}
              opacity={dim ? 0.12 : active ? 0.85 : baseOpacity}
            />
          );
        })}

        {/* Vertices */}
        {verts.map((v, vi) => {
          const adjToHl = hlVertSet.has(vi);
          const isHovered = hlVertex === vi;
          const dim = anyHl && !adjToHl && !isHovered;
          const lv0Info = THEORY_LEVELS[v.lv0];
          const lv1Info = THEORY_LEVELS[v.lv1];
          const vDepth = vertDepths[vi];
          const baseFillOpacity = depthOpacity(vDepth, 0.25, 0.8);
          const baseStrokeOpacity = depthOpacity(vDepth, 0.2, 0.7);

          return (
            <g
              key={`v-${vi}`}
              onMouseEnter={() => {
                setHlVertex(vi);
                onEnter(v.lv0);
              }}
              onMouseLeave={() => {
                setHlVertex(null);
                onLeave();
              }}
              onClick={() => onTap(v.lv0)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={v.x} cy={v.y} r={DOT_R + 6} fill="transparent" />
              <circle
                cx={v.x}
                cy={v.y}
                r={DOT_R}
                fill={v.midColor}
                fillOpacity={adjToHl || isHovered ? 0.9 : dim ? 0.15 : baseFillOpacity}
                stroke={adjToHl || isHovered ? "#fff" : v.midColor}
                strokeWidth={isHovered ? 2 : adjToHl ? 1.8 : 1}
                strokeOpacity={dim ? 0.15 : baseStrokeOpacity}
              />
              {isHovered && (
                <>
                  <text
                    x={v.x - DOT_R - 3}
                    y={v.y - DOT_R - 3}
                    textAnchor="end"
                    dominantBaseline="auto"
                    fontSize={FS.xxs}
                    fontFamily="monospace"
                    fontWeight={FW.bold}
                    fill={lv0Info.color}
                    opacity={0.9}
                  >
                    {v.lv0}
                  </text>
                  <text
                    x={v.x + DOT_R + 3}
                    y={v.y - DOT_R - 3}
                    textAnchor="start"
                    dominantBaseline="auto"
                    fontSize={FS.xxs}
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
      <span className="theory-annotation" style={{ fontSize: FS.xxs, fontFamily: "monospace", color: C.textDimmer }}>
        {label}
      </span>
    </div>
  );
}

/* ── Main component ── */

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

  const hlVertSet = new Set<number>();
  if (hl !== null) {
    CUBOCTA_VERTICES.forEach((v, vi) => {
      if (v.lv0 === hl || v.lv1 === hl) hlVertSet.add(vi);
    });
  }

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

  const shared = { showFaces, hl, hlVertSet, hlVertex, hlEdgeSet, anyHl, onEnter, onLeave, onTap, setHlVertex };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg, width: "100%" }}>
      <div style={{ display: "flex", gap: SP.sm, justifyContent: "center", width: "100%" }}>
        <CuboctaView
          verts={VERTS_BLACK}
          vertDepths={VERT_DEPTH}
          sortedTri={SORTED_TRI_BLACK}
          sortedSq={SORTED_SQ_BLACK}
          backEdges={BACK_EDGES_BLACK}
          label="Black極"
          {...shared}
        />
        <CuboctaView
          verts={VERTS_WHITE}
          vertDepths={VERT_DEPTH_WHITE}
          sortedTri={SORTED_TRI_WHITE}
          sortedSq={SORTED_SQ_WHITE}
          backEdges={BACK_EDGES_WHITE}
          label="White極"
          {...shared}
        />
      </div>

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
