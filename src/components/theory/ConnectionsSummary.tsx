import React from "react";
import { C, FS, FW, SP } from "../../tokens";
import { useTranslation } from "../../i18n";
import { AG32_PLANES, THEORY_LEVELS, FANO_LINES } from "./theory-data";

/* ── Card styles ── */

const S_CARD: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  overflow: "hidden",
};

const S_CARD_HEADER: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `${SP.sm}px ${SP.lg}px`,
  fontFamily: "monospace",
  fontSize: FS.md,
  fontWeight: FW.bold,
  minHeight: 44,
};

const S_CARD_BODY: React.CSSProperties = {
  padding: `0 ${SP.lg}px ${SP.lg}px`,
  fontFamily: "monospace",
  fontSize: FS.sm,
  lineHeight: 1.6,
};

const S_SUMMARY: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: `${SP.lg}px`,
  fontFamily: "monospace",
  fontSize: FS.sm,
  lineHeight: 1.8,
  color: C.textMuted,
};

/* ── Connection cards data (new order: Fano≅Hamming → Cube → Gray → Boolean) ── */

const CARDS = [
  {
    titleKey: "theory_conn_fano_hamming",
    hookKey: "theory_conn_fano_hamming_hook",
    detailKey: "theory_conn_fano_hamming_detail",
    color: "#b080d0",
  },
  {
    titleKey: "theory_conn_cube_geometry",
    hookKey: "theory_conn_cube_geometry_hook",
    detailKey: "theory_conn_cube_geometry_detail",
    color: "#80c0a0",
  },
  {
    titleKey: "theory_conn_gray_card",
    hookKey: "theory_conn_gray_hook",
    detailKey: "theory_conn_gray_detail",
    color: "#60aaff",
  },
  {
    titleKey: "theory_conn_boolean",
    hookKey: "theory_conn_boolean_hook",
    detailKey: "",
    color: "#ffa060",
  },
] as const;

export const ConnectionsSummary = React.memo(function ConnectionsSummary() {
  const { t } = useTranslation();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.xl, width: "100%" }}>
      {/* Connection cards */}
      {CARDS.map((card, ci) => (
        <div key={"card" + ci} className="theory-conn-card" style={{ ...S_CARD, borderColor: card.color }}>
          <div className="theory-conn-card-header" style={{ ...S_CARD_HEADER, color: card.color }}>
            <span>{t(card.titleKey as Parameters<typeof t>[0])}</span>
          </div>
          <div className="theory-conn-card-body" style={S_CARD_BODY}>
            <p style={{ color: C.textPrimary, margin: `0 0 ${SP.sm}px` }}>{t(card.hookKey as Parameters<typeof t>[0])}</p>
            {card.detailKey && (
              <p className="theory-conn-card-detail" style={{ color: C.textDimmer, margin: 0, fontSize: FS.xs }}>
                {t(card.detailKey as Parameters<typeof t>[0])}
              </p>
            )}
          </div>
        </div>
      ))}

      {/* Summary box */}
      <div className="theory-conn-summary" style={S_SUMMARY}>
        <p
          className="theory-conn-summary-title"
          style={{ color: C.accentBright, margin: `0 0 ${SP.sm}px`, fontWeight: FW.bold, fontSize: FS.md }}
        >
          {t("theory_conn_source")}
        </p>
        <p style={{ margin: `0 0 2px` }}>{t("theory_conn_fano_role")}</p>
        <p style={{ margin: `0 0 2px` }}>{t("theory_conn_cube_role")}</p>
        <p style={{ margin: `0 0 2px` }}>{t("theory_conn_hamming_role")}</p>
        <p style={{ margin: `0 0 2px`, color: C.textDimmer }}>{t("theory_conn_boolean_role")}</p>
        <p style={{ margin: 0, color: C.textDimmer }}>{t("theory_conn_extended")}</p>
      </div>

      {/* AG(3,2) affine planes */}
      <div className="theory-conn-card" style={{ ...S_CARD, borderColor: "#80b0c0" }}>
        <div className="theory-conn-card-header" style={{ ...S_CARD_HEADER, color: "#80b0c0" }}>
          <span>{t("theory_conn_ag32")}</span>
        </div>
        <div className="theory-conn-card-body" style={S_CARD_BODY}>
          <p style={{ color: C.textPrimary, margin: `0 0 ${SP.sm}px` }}>{t("theory_conn_ag32_hook")}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {Array.from({ length: 7 }).map((_, fi) => {
              const plane0 = AG32_PLANES[fi * 2];
              const plane1 = AG32_PLANES[fi * 2 + 1];
              const line = FANO_LINES[fi];
              return (
                <div key={`ag${fi}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, fontFamily: "monospace" }}>
                  <span style={{ color: C.textDimmer, width: 16 }}>π{fi + 1}</span>
                  <div style={{ display: "flex", gap: 2 }}>
                    {plane0.elements.map((el) => (
                      <span
                        key={`p0${el}`}
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: el === 0 ? "#333" : THEORY_LEVELS[el].color,
                          border: el === 0 ? "1px solid #666" : "none",
                          display: "inline-block",
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ color: C.textDimmer }}>∥</span>
                  <div style={{ display: "flex", gap: 2 }}>
                    {plane1.elements.map((el) => (
                      <span
                        key={`p1${el}`}
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: THEORY_LEVELS[el].color,
                          display: "inline-block",
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ color: C.textDimmer, marginLeft: 4 }}>
                    ← L{fi + 1}:{"{"}
                    {line.map((p) => THEORY_LEVELS[p].short).join(",")}
                    {"}"}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="theory-conn-card-detail" style={{ color: C.textDimmer, margin: `${SP.sm}px 0 0`, fontSize: FS.xs }}>
            {t("theory_conn_ag32_detail")}
          </p>
        </div>
      </div>

      {/* Polyhedra transformation network */}
      <div className="theory-conn-card" style={{ ...S_CARD, borderColor: "#90b090" }}>
        <div className="theory-conn-card-header" style={{ ...S_CARD_HEADER, color: "#90b090" }}>
          <span>{t("theory_conn_polyhedra")}</span>
        </div>
        <div className="theory-conn-card-body" style={S_CARD_BODY}>
          <svg viewBox="0 0 360 170" style={{ width: "100%", maxWidth: 360 }}>
            {(() => {
              const nodes = [
                { id: "cube", label: "立方体 Q₃", x: 90, y: 30, color: "#ffa060" },
                { id: "octa", label: "八面体", x: 270, y: 30, color: "#60ffa0" },
                { id: "tetra", label: "T₀/T₁", x: 90, y: 100, color: "#ffcc60" },
                { id: "trunc", label: "切頂四面体", x: 90, y: 155, color: "#ccaa60" },
              ];
              const edges = [
                { from: "cube", to: "octa", label: "双対", dash: false, bidirectional: true },
                { from: "cube", to: "tetra", label: "頂点交替", dash: true, bidirectional: false },
                { from: "tetra", to: "trunc", label: "切頂(T₀)", dash: true, bidirectional: false },
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
                            fontSize={8}
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
                          fontSize={7}
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
                      <rect
                        x={n.x - 42}
                        y={n.y - 10}
                        width={84}
                        height={20}
                        rx={4}
                        fill="rgba(0,0,0,0.5)"
                        stroke={n.color}
                        strokeWidth={1}
                      />
                      <text
                        x={n.x}
                        y={n.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={8}
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
          <p className="theory-conn-card-detail" style={{ color: C.textDimmer, margin: `${SP.sm}px 0 0`, fontSize: FS.xs }}>
            {t("theory_conn_polyhedra_desc")}
          </p>
        </div>
      </div>

      {/* Framework limits */}
      <div className="theory-conn-card" style={{ ...S_CARD, borderColor: C.border }}>
        <div className="theory-conn-card-header" style={{ ...S_CARD_HEADER, color: C.textDimmer }}>
          <span>{t("theory_conn_boundary_title")}</span>
        </div>
        <div className="theory-conn-card-body" style={S_CARD_BODY}>
          <p style={{ color: C.textDimmer, margin: `0 0 ${SP.sm}px`, fontSize: FS.xs }}>{t("theory_conn_boundary")}</p>
          <p style={{ color: C.textDimmer, margin: `0 0 2px`, fontSize: FS.xs }}>{t("theory_conn_168_decomp")}</p>
          <p style={{ color: C.textDimmer, margin: `0 0 2px`, fontSize: FS.xs }}>{t("theory_conn_e8_chain")}</p>
          <p style={{ color: C.textDimmer, margin: 0, fontSize: FS.xs }}>{t("theory_conn_5fold")}</p>
        </div>
      </div>

      {/* Closing tagline */}
      <div className="theory-conn-footer" style={{ textAlign: "center" }}>
        <p style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.textMuted, margin: 0 }}>{t("theory_conn_conclusion_1")}</p>
        <p style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.accentBright, margin: 0 }}>{t("theory_conn_conclusion_2")}</p>
      </div>
    </div>
  );
});
