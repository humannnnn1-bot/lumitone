import React, { useState, useCallback } from "react";
import {
  THEORY_LEVELS,
  CUBE_POINTS,
  CUBE_POINTS_WHITE,
  RHOMBIC_OCTA_VERTICES,
  RHOMBIC_OCTA_VERTICES_WHITE,
  RHOMBIC_EDGES,
  RHOMBIC_FACES,
  edgeChannel,
  RhombicOctaVertex,
} from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { S_BTN } from "../../styles";
import { usePinReset } from "./pin-reset";

const W = 200,
  H = 200;
const CUBE_R = 7;
const OCTA_R = 4;

const CHANNEL_COLORS: Record<string, string> = { G: "#00ff00", R: "#ff0000", B: "#0000ff" };

/** Cross product of 2D vectors (p1-p0) × (p2-p0) — positive = front-facing */
function crossZ(p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
}

/* ── Rescale helpers ── */
const ORIG_CX = 150,
  ORIG_CY = 150;
const NEW_CX = W / 2,
  NEW_CY = H / 2;
const FIT_SCALE = (W - 30) / 220;

function rescalePt(p: { x: number; y: number }): { x: number; y: number } {
  return { x: NEW_CX + (p.x - ORIG_CX) * FIT_SCALE, y: NEW_CY + (p.y - ORIG_CY) * FIT_SCALE };
}

function rescaleCubePoints(pts: Record<number, { x: number; y: number }>): Record<number, { x: number; y: number }> {
  const out: Record<number, { x: number; y: number }> = {};
  for (let i = 0; i < 8; i++) out[i] = rescalePt(pts[i]);
  return out;
}

function rescaleOctaVerts(verts: RhombicOctaVertex[]): RhombicOctaVertex[] {
  return verts.map((v) => ({ ...v, ...rescalePt(v) }));
}

const CUBE_PTS_B = rescaleCubePoints(CUBE_POINTS);
const CUBE_PTS_W = rescaleCubePoints(CUBE_POINTS_WHITE);
const OCTA_VERTS_B = rescaleOctaVerts(RHOMBIC_OCTA_VERTICES);
const OCTA_VERTS_W = rescaleOctaVerts(RHOMBIC_OCTA_VERTICES_WHITE);

/* ── Back-edge computation ── */

function computeBackEdges(cubePts: Record<number, { x: number; y: number }>, octaVerts: RhombicOctaVertex[]): Set<number> {
  const edgeFaces = new Map<string, number[]>();
  const ek = (cv: number, oi: number) => `${cv}-${oi}`;

  RHOMBIC_FACES.forEach((f, fi) => {
    const edges = [
      ek(f.cubeVerts[0], f.octaIdxs[0]),
      ek(f.cubeVerts[1], f.octaIdxs[0]),
      ek(f.cubeVerts[1], f.octaIdxs[1]),
      ek(f.cubeVerts[0], f.octaIdxs[1]),
    ];
    for (const e of edges) {
      if (!edgeFaces.has(e)) edgeFaces.set(e, []);
      edgeFaces.get(e)!.push(fi);
    }
  });

  function faceIsFront(fi: number): boolean {
    const f = RHOMBIC_FACES[fi];
    const ca = cubePts[f.cubeVerts[0]];
    const o1 = octaVerts[f.octaIdxs[0]];
    const cb = cubePts[f.cubeVerts[1]];
    return crossZ(ca, o1, cb) > 0;
  }

  const backEdges = new Set<number>();
  RHOMBIC_EDGES.forEach((e, ei) => {
    const k = ek(e.cubeVert, e.octaIdx);
    const faces = edgeFaces.get(k);
    if (faces && faces.length === 2 && !faceIsFront(faces[0]) && !faceIsFront(faces[1])) {
      backEdges.add(ei);
    }
  });
  return backEdges;
}

const BACK_EDGES_B = computeBackEdges(CUBE_PTS_B, OCTA_VERTS_B);
const BACK_EDGES_W = computeBackEdges(CUBE_PTS_W, OCTA_VERTS_W);

/** Normalized depth [0..1] for cube-type vertices */
const bitSum = (v: number) => (v & 1) + ((v >> 1) & 1) + ((v >> 2) & 1);
const CUBE_DEPTH: Record<number, number> = {};
const CUBE_DEPTH_WHITE: Record<number, number> = {};
for (let i = 0; i < 8; i++) {
  CUBE_DEPTH[i] = bitSum(i) / 3;
  CUBE_DEPTH_WHITE[i] = 1 - bitSum(i) / 3;
}

/** Depth for octa-type vertices = average of their 4 adjacent cube vertex depths */
function computeOctaDepths(cubeDepth: Record<number, number>): number[] {
  return RHOMBIC_OCTA_VERTICES.map((ov) => {
    const bit = ov.axis === "G" ? 2 : ov.axis === "R" ? 1 : 0;
    const val = ov.sign === 1 ? 1 : 0;
    let sum = 0,
      count = 0;
    for (let i = 0; i < 8; i++) {
      if (((i >> bit) & 1) === val) {
        sum += cubeDepth[i];
        count++;
      }
    }
    return sum / count;
  });
}

const OCTA_DEPTH_B = computeOctaDepths(CUBE_DEPTH);
const OCTA_DEPTH_W = computeOctaDepths(CUBE_DEPTH_WHITE);

function depthOpacity(depth: number, min: number, max: number): number {
  return min + depth * (max - min);
}

/* ── Sub-component for one view ── */

interface ViewProps {
  cubePts: Record<number, { x: number; y: number }>;
  octaVerts: RhombicOctaVertex[];
  backEdges: Set<number>;
  cubeDepth: Record<number, number>;
  octaDepth: number[];
  showFaces: boolean;
  hl: number | null;
  hlEdgeSet: Set<number>;
  hlFaceSet: Set<number>;
  hlFaceIdx: number | null;
  setHlFaceIdx: (idx: number | null) => void;
  anyHl: boolean;
  onEnter: (lv: number) => void;
  onLeave: () => void;
  onTap: (lv: number) => void;
  label: string;
}

function RhombicView({
  cubePts,
  octaVerts,
  backEdges,
  cubeDepth,
  octaDepth,
  showFaces,
  hl,
  hlEdgeSet,
  hlFaceSet,
  hlFaceIdx,
  setHlFaceIdx,
  anyHl,
  onEnter,
  onLeave,
  onTap,
  label,
}: ViewProps) {
  const facePolygons = RHOMBIC_FACES.map((f) => {
    const ca = cubePts[f.cubeVerts[0]];
    const o1 = octaVerts[f.octaIdxs[0]];
    const cb = cubePts[f.cubeVerts[1]];
    const o2 = octaVerts[f.octaIdxs[1]];
    return `${ca.x},${ca.y} ${o1.x},${o1.y} ${cb.x},${cb.y} ${o2.x},${o2.y}`;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.xs, flex: 1, minWidth: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }}>
        {/* Rhombic faces */}
        {RHOMBIC_FACES.map((f, fi) => {
          const faceActive = hlFaceIdx === fi || hlFaceSet.has(fi);
          const faceDim = anyHl && !faceActive;
          const ch = edgeChannel(f.cubeVerts[0], f.cubeVerts[1]);
          const chColor = CHANNEL_COLORS[ch];

          const ca = cubePts[f.cubeVerts[0]];
          const cb = cubePts[f.cubeVerts[1]];
          const o1 = octaVerts[f.octaIdxs[0]];
          const o2 = octaVerts[f.octaIdxs[1]];
          const cx = (ca.x + cb.x + o1.x + o2.x) / 4;
          const cy = (ca.y + cb.y + o1.y + o2.y) / 4;

          return (
            <g
              key={`face-${fi}`}
              onMouseEnter={() => setHlFaceIdx(fi)}
              onMouseLeave={() => setHlFaceIdx(null)}
              style={{ cursor: "default" }}
            >
              <polygon points={facePolygons[fi]} fill="transparent" />
              <polygon
                points={facePolygons[fi]}
                fill={faceActive ? chColor : "rgba(255,255,255,0.04)"}
                fillOpacity={faceActive ? 0.25 : showFaces ? (faceDim ? 0.02 : 1) : 0}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={faceActive ? 1.5 : 0.7}
                strokeOpacity={faceActive ? 0.8 : faceDim ? 0.06 : 0.15}
                strokeLinejoin="round"
              />
              {hlFaceIdx === fi && (
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={7}
                  fontFamily="monospace"
                  fontWeight={FW.bold}
                  fill={chColor}
                  opacity={0.9}
                >
                  {THEORY_LEVELS[f.cubeVerts[0]].name[0]}
                  {"\u2194"}
                  {THEORY_LEVELS[f.cubeVerts[1]].name[0]}
                </text>
              )}
            </g>
          );
        })}

        {/* Edges */}
        {RHOMBIC_EDGES.map((e, ei) => {
          const cubeP = cubePts[e.cubeVert];
          const octaP = octaVerts[e.octaIdx];
          const active = hlEdgeSet.has(ei);
          const inHoveredFace =
            hlFaceIdx !== null &&
            (RHOMBIC_FACES[hlFaceIdx].cubeVerts[0] === e.cubeVert || RHOMBIC_FACES[hlFaceIdx].cubeVerts[1] === e.cubeVert) &&
            (RHOMBIC_FACES[hlFaceIdx].octaIdxs[0] === e.octaIdx || RHOMBIC_FACES[hlFaceIdx].octaIdxs[1] === e.octaIdx);
          const edgeActive = active || inHoveredFace;
          const dim = anyHl && !edgeActive;
          const back = backEdges.has(ei);
          const eDepth = (cubeDepth[e.cubeVert] + octaDepth[e.octaIdx]) / 2;
          const baseOpacity = depthOpacity(eDepth, 0.1, 0.4);

          return (
            <line
              key={`e-${ei}`}
              x1={cubeP.x}
              y1={cubeP.y}
              x2={octaP.x}
              y2={octaP.y}
              stroke={edgeActive ? "#fff" : C.textDimmer}
              strokeWidth={edgeActive ? 1.5 : 0.6}
              strokeDasharray={back && !edgeActive ? "3,3" : undefined}
              opacity={dim ? 0.1 : edgeActive ? 0.8 : baseOpacity}
            />
          );
        })}

        {/* Octahedron-type vertices (diamonds) */}
        {octaVerts.map((ov, oi) => {
          const chColor = CHANNEL_COLORS[ov.axis];
          const connectedToHl = hl !== null && RHOMBIC_EDGES.some((e) => e.cubeVert === hl && e.octaIdx === oi);
          const inHoveredFace =
            hlFaceIdx !== null && (RHOMBIC_FACES[hlFaceIdx].octaIdxs[0] === oi || RHOMBIC_FACES[hlFaceIdx].octaIdxs[1] === oi);
          const active = connectedToHl || inHoveredFace;
          const dim = anyHl && !active;
          const oDepth = octaDepth[oi];
          const baseFill = depthOpacity(oDepth, 0.05, 0.2);
          const baseStroke = depthOpacity(oDepth, 0.2, 0.7);

          const d = OCTA_R;
          const diamondPts = `${ov.x},${ov.y - d} ${ov.x + d},${ov.y} ${ov.x},${ov.y + d} ${ov.x - d},${ov.y}`;

          const dx = ov.x - NEW_CX;
          const dy = ov.y - NEW_CY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const lx = ov.x + (dx / dist) * 10;
          const ly = ov.y + (dy / dist) * 10;

          return (
            <g key={`octa-${oi}`}>
              <polygon
                points={diamondPts}
                fill={active ? chColor : "rgba(255,255,255,0.06)"}
                fillOpacity={active ? 0.4 : dim ? 0.03 : baseFill}
                stroke={active ? "#fff" : "rgba(255,255,255,0.4)"}
                strokeWidth={active ? 1.5 : 0.8}
                strokeOpacity={dim ? 0.15 : baseStroke}
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={7}
                fontFamily="monospace"
                fontWeight={FW.bold}
                fill={chColor}
                opacity={dim ? 0.15 : 0.7}
              >
                {ov.label}
              </text>
            </g>
          );
        })}

        {/* Cube-type vertices (colored circles) */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((lv) => {
          const p = cubePts[lv];
          const info = THEORY_LEVELS[lv];
          const active = hl === lv;
          const inHoveredFace =
            hlFaceIdx !== null && (RHOMBIC_FACES[hlFaceIdx].cubeVerts[0] === lv || RHOMBIC_FACES[hlFaceIdx].cubeVerts[1] === lv);
          const vertActive = active || inHoveredFace;
          const dim = anyHl && !vertActive;
          const cDepth = cubeDepth[lv];
          const cFill = depthOpacity(cDepth, 0.3, 0.9);
          const cStroke = depthOpacity(cDepth, 0.25, 0.8);

          return (
            <g
              key={`cv-${lv}`}
              onMouseEnter={() => onEnter(lv)}
              onMouseLeave={onLeave}
              onClick={() => onTap(lv)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={p.x} cy={p.y} r={CUBE_R + 6} fill="transparent" />
              {vertActive && <circle cx={p.x} cy={p.y} r={CUBE_R + 3} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />}
              <circle
                cx={p.x}
                cy={p.y}
                r={CUBE_R}
                fill={lv === 0 ? C.bgRoot : info.color}
                fillOpacity={dim ? 0.15 : vertActive ? 0.9 : cFill}
                stroke={dim ? (lv === 0 ? C.textDimmer : info.color) : "#fff"}
                strokeWidth={vertActive ? 2 : 1.2}
                strokeOpacity={dim ? 0.2 : cStroke}
              />
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.sm}
                fontWeight={FW.bold}
                fontFamily="monospace"
                fill={lv >= 4 ? "#000" : "#fff"}
                opacity={dim ? 0.2 : 0.9}
              >
                {lv}
              </text>
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

export const RhombicDodecahedron = React.memo(function RhombicDodecahedron({ hlLevel, onHover }: Props) {
  const [pinned, setPinned] = useState<number | null>(null);
  usePinReset(setPinned);
  const [showFaces, setShowFaces] = useState(false);
  const [hlFaceIdx, setHlFaceIdx] = useState<number | null>(null);

  const hl = hlLevel !== null && hlLevel >= 0 && hlLevel <= 7 ? hlLevel : pinned;

  const hlEdgeSet = new Set<number>();
  const hlFaceSet = new Set<number>();
  if (hl !== null) {
    RHOMBIC_EDGES.forEach((e, ei) => {
      if (e.cubeVert === hl) hlEdgeSet.add(ei);
    });
    RHOMBIC_FACES.forEach((f, fi) => {
      if (f.cubeVerts[0] === hl || f.cubeVerts[1] === hl) hlFaceSet.add(fi);
    });
  }

  const anyHl = hl !== null || hlFaceIdx !== null;

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

  const shared = { showFaces, hl, hlEdgeSet, hlFaceSet, hlFaceIdx, setHlFaceIdx, anyHl, onEnter, onLeave, onTap };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg, width: "100%" }}>
      <div style={{ display: "flex", gap: SP.sm, justifyContent: "center", width: "100%" }}>
        <RhombicView
          cubePts={CUBE_PTS_B}
          octaVerts={OCTA_VERTS_B}
          backEdges={BACK_EDGES_B}
          cubeDepth={CUBE_DEPTH}
          octaDepth={OCTA_DEPTH_B}
          label="Black極"
          {...shared}
        />
        <RhombicView
          cubePts={CUBE_PTS_W}
          octaVerts={OCTA_VERTS_W}
          backEdges={BACK_EDGES_W}
          cubeDepth={CUBE_DEPTH_WHITE}
          octaDepth={OCTA_DEPTH_W}
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
          Faces
        </button>
      </div>
    </div>
  );
});
