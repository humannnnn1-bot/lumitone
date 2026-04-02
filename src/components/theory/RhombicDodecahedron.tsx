import React, { useState, useCallback } from "react";
import { THEORY_LEVELS, CUBE_POINTS, RHOMBIC_OCTA_VERTICES, RHOMBIC_EDGES, RHOMBIC_FACES, edgeChannel } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { S_BTN } from "../../styles";
import { usePinReset } from "./pin-reset";
import { useTranslation } from "../../i18n";

const W = 300,
  H = 300;
const CUBE_R = 10;
const OCTA_R = 6;

const CHANNEL_COLORS: Record<string, string> = { G: "#00ff00", R: "#ff0000", B: "#0000ff" };

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const RhombicDodecahedron = React.memo(function RhombicDodecahedron({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<number | null>(null);
  usePinReset(setPinned);
  const [showFaces, setShowFaces] = useState(false);
  const [hlFaceIdx, setHlFaceIdx] = useState<number | null>(null);

  const hl = hlLevel !== null && hlLevel >= 0 && hlLevel <= 7 ? hlLevel : pinned;

  // Edges and faces adjacent to highlighted cube vertex
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

  // Build rhombus polygon points for each face
  const facePolygons = RHOMBIC_FACES.map((f) => {
    const ca = CUBE_POINTS[f.cubeVerts[0]];
    const o1 = RHOMBIC_OCTA_VERTICES[f.octaIdxs[0]];
    const cb = CUBE_POINTS[f.cubeVerts[1]];
    const o2 = RHOMBIC_OCTA_VERTICES[f.octaIdxs[1]];
    // Alternating: cube-a, octa-1, cube-b, octa-2
    return `${ca.x},${ca.y} ${o1.x},${o1.y} ${cb.x},${cb.y} ${o2.x},${o2.y}`;
  });

  // Hovered face info
  const hoveredFace = hlFaceIdx !== null ? RHOMBIC_FACES[hlFaceIdx] : null;
  const hoveredEdgeChannel = hoveredFace ? edgeChannel(hoveredFace.cubeVerts[0], hoveredFace.cubeVerts[1]) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg, width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", maxWidth: W }}
        role="img"
        aria-label={t("theory_cube_title") + " (Rhombic Dodecahedron)"}
      >
        {/* Rhombic faces */}
        {RHOMBIC_FACES.map((f, fi) => {
          const faceActive = hlFaceIdx === fi || hlFaceSet.has(fi);
          const faceDim = anyHl && !faceActive;
          const ch = edgeChannel(f.cubeVerts[0], f.cubeVerts[1]);
          const chColor = CHANNEL_COLORS[ch];

          // Centroid for label
          const ca = CUBE_POINTS[f.cubeVerts[0]];
          const cb = CUBE_POINTS[f.cubeVerts[1]];
          const o1 = RHOMBIC_OCTA_VERTICES[f.octaIdxs[0]];
          const o2 = RHOMBIC_OCTA_VERTICES[f.octaIdxs[1]];
          const cx = (ca.x + cb.x + o1.x + o2.x) / 4;
          const cy = (ca.y + cb.y + o1.y + o2.y) / 4;

          return (
            <g
              key={`face-${fi}`}
              onMouseEnter={() => setHlFaceIdx(fi)}
              onMouseLeave={() => setHlFaceIdx(null)}
              style={{ cursor: "default" }}
            >
              {/* Invisible hit area */}
              <polygon points={facePolygons[fi]} fill="transparent" />
              {/* Visible face */}
              <polygon
                points={facePolygons[fi]}
                fill={faceActive ? chColor : "rgba(255,255,255,0.04)"}
                fillOpacity={faceActive ? 0.25 : showFaces ? (faceDim ? 0.02 : 1) : 0}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={faceActive ? 1.5 : 0.7}
                strokeOpacity={faceActive ? 0.8 : faceDim ? 0.06 : 0.15}
                strokeLinejoin="round"
              />
              {/* Face label on hover — show the two cube colors connected */}
              {hlFaceIdx === fi && (
                <g>
                  <text
                    x={cx}
                    y={cy - 4}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={FS.xxs}
                    fontFamily="monospace"
                    fontWeight={FW.bold}
                    fill={chColor}
                    opacity={0.9}
                  >
                    {THEORY_LEVELS[f.cubeVerts[0]].name[0]}
                    {"\u2194"}
                    {THEORY_LEVELS[f.cubeVerts[1]].name[0]}
                  </text>
                  <text
                    x={cx}
                    y={cy + 5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={FS.xxs}
                    fontFamily="monospace"
                    fill="rgba(255,255,255,0.5)"
                  >
                    {ch}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Edges: cube-type to octa-type */}
        {RHOMBIC_EDGES.map((e, ei) => {
          const cubeP = CUBE_POINTS[e.cubeVert];
          const octaP = RHOMBIC_OCTA_VERTICES[e.octaIdx];
          const active = hlEdgeSet.has(ei);
          // Also highlight edges belonging to hovered face
          const inHoveredFace =
            hlFaceIdx !== null &&
            (RHOMBIC_FACES[hlFaceIdx].cubeVerts[0] === e.cubeVert || RHOMBIC_FACES[hlFaceIdx].cubeVerts[1] === e.cubeVert) &&
            (RHOMBIC_FACES[hlFaceIdx].octaIdxs[0] === e.octaIdx || RHOMBIC_FACES[hlFaceIdx].octaIdxs[1] === e.octaIdx);
          const edgeActive = active || inHoveredFace;
          const dim = anyHl && !edgeActive;

          return (
            <line
              key={`e-${ei}`}
              x1={cubeP.x}
              y1={cubeP.y}
              x2={octaP.x}
              y2={octaP.y}
              stroke={edgeActive ? "#fff" : C.textDimmer}
              strokeWidth={edgeActive ? 1.5 : 0.6}
              opacity={dim ? 0.1 : edgeActive ? 0.8 : 0.3}
            />
          );
        })}

        {/* Octahedron-type vertices (diamonds) */}
        {RHOMBIC_OCTA_VERTICES.map((ov, oi) => {
          const chColor = CHANNEL_COLORS[ov.axis];
          // Active if connected to hovered cube vertex or part of hovered face
          const connectedToHl = hl !== null && RHOMBIC_EDGES.some((e) => e.cubeVert === hl && e.octaIdx === oi);
          const inHoveredFace =
            hlFaceIdx !== null && (RHOMBIC_FACES[hlFaceIdx].octaIdxs[0] === oi || RHOMBIC_FACES[hlFaceIdx].octaIdxs[1] === oi);
          const active = connectedToHl || inHoveredFace;
          const dim = anyHl && !active;

          // Diamond shape (rotated square)
          const d = OCTA_R;
          const diamondPts = `${ov.x},${ov.y - d} ${ov.x + d},${ov.y} ${ov.x},${ov.y + d} ${ov.x - d},${ov.y}`;

          // Label offset: push outward from center
          const dx = ov.x - 150;
          const dy = ov.y - 140;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const lx = ov.x + (dx / dist) * 14;
          const ly = ov.y + (dy / dist) * 14;

          return (
            <g key={`octa-${oi}`}>
              <polygon
                points={diamondPts}
                fill={active ? chColor : "rgba(255,255,255,0.06)"}
                fillOpacity={active ? 0.4 : dim ? 0.03 : 0.15}
                stroke={active ? "#fff" : "rgba(255,255,255,0.4)"}
                strokeWidth={active ? 1.5 : 0.8}
                strokeOpacity={dim ? 0.15 : 0.7}
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.xxs}
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
          const p = CUBE_POINTS[lv];
          const info = THEORY_LEVELS[lv];
          const active = hl === lv;
          const inHoveredFace =
            hlFaceIdx !== null && (RHOMBIC_FACES[hlFaceIdx].cubeVerts[0] === lv || RHOMBIC_FACES[hlFaceIdx].cubeVerts[1] === lv);
          const vertActive = active || inHoveredFace;
          const dim = anyHl && !vertActive;

          return (
            <g
              key={`cv-${lv}`}
              onMouseEnter={() => onEnter(lv)}
              onMouseLeave={onLeave}
              onClick={() => onTap(lv)}
              style={{ cursor: "pointer" }}
            >
              {/* Larger hit area */}
              <circle cx={p.x} cy={p.y} r={CUBE_R + 6} fill="transparent" />
              {/* Highlight ring */}
              {vertActive && <circle cx={p.x} cy={p.y} r={CUBE_R + 3} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />}
              {/* Vertex circle */}
              <circle
                cx={p.x}
                cy={p.y}
                r={CUBE_R}
                fill={lv === 0 ? C.bgRoot : info.color}
                fillOpacity={dim ? 0.15 : 0.85}
                stroke={dim ? (lv === 0 ? C.textDimmer : info.color) : "#fff"}
                strokeWidth={vertActive ? 2 : 1.2}
                strokeOpacity={dim ? 0.2 : 0.8}
              />
              {/* Level number */}
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.md}
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

        {/* Hovered face info: show the two cube vertex colors at top */}
        {hoveredFace && hoveredEdgeChannel && (
          <g>
            <circle cx={125} cy={16} r={5} fill={THEORY_LEVELS[hoveredFace.cubeVerts[0]].color} stroke="#fff" strokeWidth={0.8} />
            <text x={134} y={16} dominantBaseline="central" fontSize={FS.xs} fontFamily="monospace" fill="rgba(255,255,255,0.6)">
              {"\u2194"}
            </text>
            <circle cx={143} cy={16} r={5} fill={THEORY_LEVELS[hoveredFace.cubeVerts[1]].color} stroke="#fff" strokeWidth={0.8} />
            <text
              x={158}
              y={16}
              dominantBaseline="central"
              fontSize={FS.xs}
              fontFamily="monospace"
              fill={CHANNEL_COLORS[hoveredEdgeChannel]}
            >
              ({hoveredEdgeChannel})
            </text>
          </g>
        )}
      </svg>

      {/* Toggle button */}
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
