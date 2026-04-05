import React from "react";
import { C, FS, FW, SP } from "../../tokens";
import { useTranslation } from "../../i18n";

const S_ITEM: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: FS.sm,
  lineHeight: 1.7,
  color: C.textPrimary,
  margin: 0,
};

export const ConnectionsSummary = React.memo(function ConnectionsSummary() {
  const { t } = useTranslation();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.xl, width: "100%", maxWidth: 480 }}>
      {/* Flat bullet list */}
      <ul style={{ margin: 0, paddingLeft: SP["2xl"], display: "flex", flexDirection: "column", gap: SP.lg, width: "100%" }}>
        <li style={S_ITEM}>{t("theory_conn_fano_hamming_hook")}</li>
        <li style={S_ITEM}>{t("theory_conn_cube_geometry_hook")}</li>
        <li style={S_ITEM}>{t("theory_conn_gray_hook")}</li>
        <li style={S_ITEM}>{t("theory_conn_boolean_hook")}</li>
      </ul>

      {/* Extended Hamming note */}
      <p style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center" }}>
        {t("theory_conn_extended")}
      </p>

      {/* Framework scope */}
      <div style={{ width: "100%", borderTop: `1px solid ${C.border}`, paddingTop: SP.lg }}>
        <p style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.textDimmer, fontWeight: FW.bold, margin: `0 0 ${SP.sm}px` }}>
          {t("theory_conn_boundary_title")}
        </p>
        <p style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.textDimmer, margin: 0, lineHeight: 1.6 }}>
          {t("theory_conn_boundary")}
        </p>
      </div>

      {/* Closing tagline */}
      <div className="theory-conn-footer" style={{ textAlign: "center" }}>
        <p style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.accentBright, margin: 0 }}>{t("theory_conn_conclusion_2")}</p>
      </div>
    </div>
  );
});

/** Polyhedra transformation network SVG — displayed in Tetra&Stella §10 */
export const PolyhedraNetwork = React.memo(function PolyhedraNetwork() {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md, width: "100%" }}>
      <p style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.accentBright, fontWeight: FW.bold, margin: 0 }}>
        {t("theory_conn_polyhedra")}
      </p>
      <svg viewBox="0 0 360 170" style={{ width: "100%", maxWidth: 360 }}>
        {(() => {
          const nodes = [
            { id: "cube", label: "Cube Q\u2083", x: 90, y: 30, color: "#ffa060" },
            { id: "octa", label: "Octahedron", x: 270, y: 30, color: "#60ffa0" },
            { id: "tetra", label: "T\u2080/T\u2081", x: 90, y: 100, color: "#ffcc60" },
            { id: "trunc", label: "Trunc.Tetra", x: 90, y: 155, color: "#ccaa60" },
          ];
          const edges = [
            { from: "cube", to: "octa", label: "dual", dash: false, bidirectional: true },
            { from: "cube", to: "tetra", label: "vertex alt.", dash: true, bidirectional: false },
            { from: "tetra", to: "trunc", label: "truncation", dash: true, bidirectional: false },
          ];
          const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
          return (
            <>
              {edges.map((e, i) => {
                const from = nodeMap[e.from],
                  to = nodeMap[e.to];
                const mx = (from.x + to.x) / 2,
                  my = (from.y + to.y) / 2;
                const dx = to.x - from.x,
                  dy = to.y - from.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const perpX = (-dy / len) * 8,
                  perpY = (dx / len) * 8;
                return (
                  <g key={`pe-${i}`}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth={1}
                      strokeDasharray={e.dash ? "4,3" : undefined}
                      markerEnd={!e.bidirectional ? "url(#arrowPoly)" : undefined}
                    />
                    {e.bidirectional && (
                      <text
                        x={mx + perpX}
                        y={my + perpY}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={FS.xs}
                        fontFamily="monospace"
                        fill="rgba(255,255,255,0.5)"
                      >
                        ↔
                      </text>
                    )}
                    <text
                      x={mx + perpX * (e.bidirectional ? 2.2 : 1)}
                      y={my + perpY * (e.bidirectional ? 2.2 : 1)}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={FS.xxs}
                      fontFamily="monospace"
                      fill="rgba(255,255,255,0.45)"
                    >
                      {e.label}
                    </text>
                  </g>
                );
              })}
              <defs>
                <marker id="arrowPoly" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                  <path d="M0,0 L6,2 L0,4" fill="rgba(255,255,255,0.3)" />
                </marker>
              </defs>
              {nodes.map((n) => (
                <g key={`pn-${n.id}`}>
                  <rect x={n.x - 42} y={n.y - 10} width={84} height={20} rx={4} fill="rgba(0,0,0,0.5)" stroke={n.color} strokeWidth={1} />
                  <text
                    x={n.x}
                    y={n.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={FS.xs}
                    fontFamily="monospace"
                    fill={n.color}
                    fontWeight={700}
                  >
                    {n.label}
                  </text>
                </g>
              ))}
            </>
          );
        })()}
      </svg>
      <p
        className="theory-annotation"
        style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center", lineHeight: 1.6 }}
      >
        {t("theory_conn_polyhedra_desc")}
      </p>
    </div>
  );
});
