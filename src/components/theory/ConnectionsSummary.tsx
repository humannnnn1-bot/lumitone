import React from "react";
import { C, FS, FW, SP } from "../../tokens";
import { useTranslation } from "../../i18n";

const STRUCTURES = [
  { key: "gf23", color: "#80a0ff" },
  { key: "fano", color: "#60ffa0" },
  { key: "cube", color: "#ffa060" },
  { key: "gray", color: "#ff60a0" },
  { key: "hamming", color: "#a060ff" },
] as const;

const W = 340,
  H = 260;
const CX = 170,
  CY = 110,
  R = 80;

export const ConnectionsSummary = React.memo(function ConnectionsSummary() {
  const { t } = useTranslation();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.xl }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }} role="img" aria-label={t("theory_connections_title")}>
        {/* Central node */}
        <circle cx={CX} cy={CY} r={28} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={FS.xs}
          fontFamily="monospace"
          fill={C.textPrimary}
          fontWeight={FW.bold}
        >
          {t("theory_conn_center_1")}
        </text>
        <text x={CX} y={CY + 8} textAnchor="middle" dominantBaseline="central" fontSize={FS.xs} fontFamily="monospace" fill={C.textMuted}>
          {t("theory_conn_center_2")}
        </text>

        {/* Orbiting structure nodes */}
        {STRUCTURES.map((s, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STRUCTURES.length;
          const x = CX + R * Math.cos(angle);
          const y = CY + R * Math.sin(angle);
          // Line from center to node
          return (
            <g key={s.key}>
              <line x1={CX} y1={CY} x2={x} y2={y} stroke={s.color} strokeWidth={1} opacity={0.3} />
              <circle cx={x} cy={y} r={16} fill="rgba(0,0,0,0.5)" stroke={s.color} strokeWidth={1.5} />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.xxs}
                fontFamily="monospace"
                fill={s.color}
                fontWeight={FW.bold}
              >
                {t(`theory_conn_${s.key}` as Parameters<typeof t>[0])}
              </text>
            </g>
          );
        })}

        {/* Connecting arcs between adjacent nodes */}
        {STRUCTURES.map((_, i) => {
          const j = (i + 1) % STRUCTURES.length;
          const a1 = -Math.PI / 2 + (i * 2 * Math.PI) / STRUCTURES.length;
          const a2 = -Math.PI / 2 + (j * 2 * Math.PI) / STRUCTURES.length;
          const x1 = CX + R * Math.cos(a1),
            y1 = CY + R * Math.sin(a1);
          const x2 = CX + R * Math.cos(a2),
            y2 = CY + R * Math.sin(a2);
          return (
            <line key={"arc" + i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.1)" strokeWidth={0.8} strokeDasharray="2,3" />
          );
        })}

        {/* Bottom text */}
        <text x={CX} y={H - 30} textAnchor="middle" fontSize={FS.sm} fontFamily="monospace" fill={C.textMuted}>
          {t("theory_conn_conclusion_1")}
        </text>
        <text x={CX} y={H - 16} textAnchor="middle" fontSize={FS.sm} fontFamily="monospace" fill={C.accentBright}>
          {t("theory_conn_conclusion_2")}
        </text>
      </svg>
    </div>
  );
});
