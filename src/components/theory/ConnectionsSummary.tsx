import React from "react";
import { C, FS, SP } from "../../tokens";
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

      {/* Closing tagline */}
      <div className="theory-conn-footer" style={{ textAlign: "center" }}>
        <p style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.accentBright, margin: 0 }}>{t("theory_conn_conclusion_2")}</p>
      </div>
    </div>
  );
});

export const ScopeSummary = React.memo(function ScopeSummary() {
  const { t } = useTranslation();

  return (
    <div style={{ width: "100%", maxWidth: 480, borderTop: `1px solid ${C.border}`, paddingTop: SP.lg }}>
      <p style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.textDimmer, margin: 0, lineHeight: 1.6 }}>
        {t("theory_conn_boundary")}
      </p>
    </div>
  );
});

/** Polyhedra transformation network SVG — displayed in Tetra&Stella §10 */
export const PolyhedraNetwork = React.memo(function PolyhedraNetwork() {
  const { t } = useTranslation();
  const titleId = React.useId();
  const descId = React.useId();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md, width: "100%" }}>
      <svg viewBox="0 0 400 340" style={{ width: "100%", maxWidth: 360 }} role="img" aria-labelledby={titleId} aria-describedby={descId}>
        <title id={titleId}>{t("theory_conn_polyhedra")}</title>
        <desc id={descId}>{t("theory_conn_polyhedra_svg_desc")}</desc>
        {(() => {
          const nodes = [
            { id: "cube", label: t("theory_pn_cube"), x: 200, y: 35, color: "#ffa060" },
            { id: "octa", label: t("theory_pn_octa"), x: 335, y: 170, color: "#60ffa0" },
            { id: "tetra", label: t("theory_pn_tetra"), x: 65, y: 170, color: "#ffcc60" },
            { id: "stella", label: t("theory_pn_stella"), x: 200, y: 305, color: "#60ccaa" },
          ];
          const edges = [
            { from: "cube", to: "octa", label: t("theory_pn_fv_rev"), dash: false, bidirectional: false },
            { from: "cube", to: "tetra", label: t("theory_pn_parity"), dash: false, bidirectional: false },
            { from: "octa", to: "stella", label: t("theory_pn_stellation"), dash: false, bidirectional: false },
            { from: "tetra", to: "stella", label: t("theory_pn_compound"), dash: false, bidirectional: false },
          ];
          const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
          const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
          const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
          return (
            <>
              {edges.map((e, i) => {
                const from = nodeMap[e.from],
                  to = nodeMap[e.to];
                const dx = to.x - from.x,
                  dy = to.y - from.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const ux = dx / len,
                  uy = dy / len;
                // Shrink line ends to clear node rects (half-width 50, half-height 10)
                const clipStart = Math.min(Math.abs(52 / (Math.abs(ux) || 1)), Math.abs(14 / (Math.abs(uy) || 1)));
                const clipEnd = clipStart;
                const x1 = from.x + ux * clipStart,
                  y1 = from.y + uy * clipStart;
                const x2 = to.x - ux * clipEnd,
                  y2 = to.y - uy * clipEnd;
                const mx = (from.x + to.x) / 2,
                  my = (from.y + to.y) / 2;
                // Perpendicular pointing outward from diamond center
                let perpX = -uy * 14,
                  perpY = ux * 14;
                const outX = mx - cx,
                  outY = my - cy;
                if (perpX * outX + perpY * outY < 0) {
                  perpX = -perpX;
                  perpY = -perpY;
                }
                return (
                  <g key={`pe-${i}`}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
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
                      fontSize={10}
                      fontFamily="monospace"
                      fill="rgba(255,255,255,0.45)"
                    >
                      {e.label}
                    </text>
                  </g>
                );
              })}
              <defs>
                <marker id="arrowPoly" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6" fill="rgba(255,255,255,0.5)" />
                </marker>
              </defs>
              {/* Composite arrow: Cube -> Stella (dashed, vertical) */}
              <line
                x1={cx}
                y1={nodes[0].y + 10}
                x2={cx}
                y2={nodes[3].y - 10}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={1}
                strokeDasharray="4,3"
                markerEnd="url(#arrowPoly)"
              />
              {/* Commutativity symbol at diamond center */}
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={30} fill="rgba(255,255,255,0.35)">
                &#x27F3;
              </text>
              {nodes.map((n) => (
                <g key={`pn-${n.id}`}>
                  <rect x={n.x - 52} y={n.y - 14} width={104} height={28} rx={4} fill="rgba(0,0,0,0.5)" stroke={n.color} strokeWidth={1} />
                  <text
                    x={n.x}
                    y={n.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={12}
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
      <p style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center" }}>
        {t("theory_conn_polyhedra_legend")}
      </p>
    </div>
  );
});
