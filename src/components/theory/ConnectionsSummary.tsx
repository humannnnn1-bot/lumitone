import React, { useState } from "react";
import { C, FS, FW, SP } from "../../tokens";
import { useTranslation } from "../../i18n";

/* ── Trinity triangle layout ── */
const TRI_W = 280,
  TRI_H = 200;
const TRI_CX = 140,
  TRI_CY = 105;
const TRI_R = 75;
// Vertices: Fano (top), Cube (bottom-left), Hamming (bottom-right)
const VERTS = [
  { key: "fano", angle: -Math.PI / 2, color: "#60ffa0" },
  { key: "cube", angle: -Math.PI / 2 + (2 * Math.PI) / 3, color: "#ffa060" },
  { key: "hamming", angle: -Math.PI / 2 + (4 * Math.PI) / 3, color: "#a060ff" },
] as const;
const getVPos = (i: number) => ({
  x: TRI_CX + TRI_R * Math.cos(VERTS[i].angle),
  y: TRI_CY + TRI_R * Math.sin(VERTS[i].angle),
});
// Edges: 0=Cube↔Fano, 1=Fano↔Hamming, 2=Cube↔Hamming
const EDGES = [
  { from: 1, to: 0, labelKey: "subspaces", cardIdx: 0 },
  { from: 0, to: 2, labelKey: "codewords", cardIdx: 1 },
  { from: 1, to: 2, labelKey: "checks", cardIdx: 2 },
] as const;

/* ── Connection cards data ── */
const CARDS = [
  { titleKey: "theory_conn_cube_fano", hookKey: "theory_conn_cube_fano_hook", detailKey: "theory_conn_cube_fano_detail", color: "#80c0a0" },
  {
    titleKey: "theory_conn_fano_hamming",
    hookKey: "theory_conn_fano_hamming_hook",
    detailKey: "theory_conn_fano_hamming_detail",
    color: "#b080d0",
  },
  {
    titleKey: "theory_conn_cube_hamming",
    hookKey: "theory_conn_cube_hamming_hook",
    detailKey: "theory_conn_cube_hamming_detail",
    color: "#c0a060",
  },
] as const;

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

export const ConnectionsSummary = React.memo(function ConnectionsSummary() {
  const { t } = useTranslation();
  const [hlEdge, setHlEdge] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.xl }}>
      {/* Part A: Trinity triangle */}
      <svg viewBox={`0 0 ${TRI_W} ${TRI_H}`} style={{ width: "100%", maxWidth: TRI_W }}>
        {/* Edges */}
        {EDGES.map((e, ei) => {
          const p0 = getVPos(e.from),
            p1 = getVPos(e.to);
          const mx = (p0.x + p1.x) / 2,
            my = (p0.y + p1.y) / 2;
          const isHl = hlEdge === ei;
          const edgeLabel = t(`theory_conn_edge_${e.labelKey}` as Parameters<typeof t>[0]);
          // Perpendicular offset for label
          const dx = p1.x - p0.x,
            dy = p1.y - p0.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpX = (-dy / len) * 12,
            perpY = (dx / len) * 12;
          return (
            <g key={"edge" + ei} onMouseEnter={() => setHlEdge(ei)} onMouseLeave={() => setHlEdge(null)} style={{ cursor: "default" }}>
              {/* Wider invisible hit area */}
              <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="transparent" strokeWidth={20} />
              <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={isHl ? "#fff" : "rgba(255,255,255,0.2)"} strokeWidth={isHl ? 2 : 1} />
              <text
                x={mx + perpX}
                y={my + perpY}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.xxs}
                fontFamily="monospace"
                fill={isHl ? "#fff" : "rgba(255,255,255,0.5)"}
              >
                {edgeLabel}
              </text>
            </g>
          );
        })}

        {/* Center label */}
        <text
          x={TRI_CX}
          y={TRI_CY - 4}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={FS.xs}
          fontFamily="monospace"
          fill={C.textMuted}
        >
          GF(2){"\u00b3"}
        </text>

        {/* Vertices */}
        {VERTS.map((v, vi) => {
          const p = getVPos(vi);
          const isAdj = hlEdge !== null && EDGES[hlEdge] && (EDGES[hlEdge].from === vi || EDGES[hlEdge].to === vi);
          const label = t(`theory_conn_${v.key}` as Parameters<typeof t>[0]);
          return (
            <g key={"vert" + vi}>
              <circle cx={p.x} cy={p.y} r={20} fill="rgba(0,0,0,0.6)" stroke={v.color} strokeWidth={isAdj ? 2.5 : 1.5} />
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.xs}
                fontFamily="monospace"
                fill={v.color}
                fontWeight={FW.bold}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Part B: Connection detail cards */}
      {CARDS.map((card, ci) => (
        <div
          key={"card" + ci}
          style={{
            ...S_CARD,
            borderColor: card.color,
            cursor: "default",
          }}
        >
          <div style={{ ...S_CARD_HEADER, color: card.color }}>
            <span>{t(card.titleKey as Parameters<typeof t>[0])}</span>
          </div>
          <div style={S_CARD_BODY}>
            <p style={{ color: C.textPrimary, margin: `0 0 ${SP.sm}px` }}>{t(card.hookKey as Parameters<typeof t>[0])}</p>
            <p style={{ color: C.textDimmer, margin: 0, fontSize: FS.xs }}>{t(card.detailKey as Parameters<typeof t>[0])}</p>
          </div>
        </div>
      ))}

      {/* Part C: Trinity summary (always visible) */}
      <div style={S_SUMMARY}>
        <p style={{ color: C.accentBright, margin: `0 0 ${SP.sm}px`, fontWeight: FW.bold, fontSize: FS.md }}>{t("theory_conn_source")}</p>
        <p style={{ margin: `0 0 2px` }}>{t("theory_conn_fano_role")}</p>
        <p style={{ margin: `0 0 2px` }}>{t("theory_conn_cube_role")}</p>
        <p style={{ margin: `0 0 2px` }}>{t("theory_conn_hamming_role")}</p>
        <p style={{ margin: `0 0 2px`, color: C.textDimmer }}>{t("theory_conn_gray_role")}</p>
        <p style={{ margin: 0, color: C.textDimmer }}>{t("theory_conn_extended")}</p>
        <p style={{ margin: `${SP.sm}px 0 0`, color: C.textDimmer, fontSize: FS.xs }}>{t("theory_conn_boundary")}</p>
      </div>

      {/* Closing tagline */}
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.textMuted, margin: 0 }}>{t("theory_conn_conclusion_1")}</p>
        <p style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.accentBright, margin: 0 }}>{t("theory_conn_conclusion_2")}</p>
      </div>
    </div>
  );
});
