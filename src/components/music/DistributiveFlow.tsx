import React from "react";
import { C, FS, FW } from "../../tokens";

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];
const W = 180,
  H = 120;
const DOT_R = 8;

type Phase = "bxc" | "left" | "ab" | "ac" | "right" | "equal" | null;

function pointColor(lv: number, activeLevels: { lv: number; rgb: [number, number, number] }[]): string {
  const al = activeLevels.find((a) => a.lv === lv);
  return al ? `rgb(${al.rgb.join(",")})` : LV_COLORS[lv];
}

interface Props {
  a: number;
  b: number;
  c: number;
  phase: Phase;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

export const DistributiveFlow = React.memo(function DistributiveFlow({ a, b, c, phase, activeLevels }: Props) {
  const bxc = b ^ c;
  const left = a & bxc;
  const ab = a & b;
  const ac = a & c;
  const right = ab ^ ac;

  // Node positions
  const nodes: { key: string; x: number; y: number; lv: number; label: string; phase: Phase }[] = [
    { key: "bxc", x: 45, y: 28, lv: bxc, label: `${b}\u2295${c}`, phase: "bxc" },
    { key: "left", x: 45, y: 68, lv: left, label: `${a}\u2227${bxc}`, phase: "left" },
    { key: "ab", x: 115, y: 18, lv: ab, label: `${a}\u2227${b}`, phase: "ab" },
    { key: "ac", x: 155, y: 18, lv: ac, label: `${a}\u2227${c}`, phase: "ac" },
    { key: "right", x: 135, y: 68, lv: right, label: `${ab}\u2295${ac}`, phase: "right" },
  ];

  // Arrows: [fromKey, toKey]
  const arrows: [string, string][] = [
    ["bxc", "left"],
    ["ab", "right"],
    ["ac", "right"],
  ];

  const isPhaseActive = (p: Phase) => phase === p || (phase === "equal" && (p === "left" || p === "right"));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }}>
      <defs>
        <filter id="df-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Input labels at top */}
      <text x={15} y={10} fontSize={FS.xxs} fontFamily="monospace" fill={C.textDimmer}>
        a={a}
      </text>
      <text x={45} y={10} fontSize={FS.xxs} fontFamily="monospace" fill={C.textDimmer}>
        b={b}
      </text>
      <text x={75} y={10} fontSize={FS.xxs} fontFamily="monospace" fill={C.textDimmer}>
        c={c}
      </text>

      {/* Path labels */}
      <text x={45} y={50} textAnchor="middle" fontSize={6} fontFamily="monospace" fill={C.textDimmer}>
        a{"\u2227"}(b{"\u2295"}c)
      </text>
      <text x={135} y={50} textAnchor="middle" fontSize={6} fontFamily="monospace" fill={C.textDimmer}>
        (a{"\u2227"}b){"\u2295"}(a{"\u2227"}c)
      </text>

      {/* Arrows */}
      {arrows.map(([from, to]) => {
        const f = nodes.find((n) => n.key === from)!;
        const t = nodes.find((n) => n.key === to)!;
        return (
          <line key={from + to} x1={f.x} y1={f.y + DOT_R} x2={t.x} y2={t.y - DOT_R} stroke={C.textDimmer} strokeWidth={0.8} opacity={0.4} />
        );
      })}

      {/* Convergence lines to bottom */}
      <line x1={45} y1={68 + DOT_R} x2={90} y2={100} stroke={C.textDimmer} strokeWidth={0.8} opacity={0.4} />
      <line x1={135} y1={68 + DOT_R} x2={90} y2={100} stroke={C.textDimmer} strokeWidth={0.8} opacity={0.4} />

      {/* Nodes */}
      {nodes.map((n) => {
        const active = isPhaseActive(n.phase);
        return (
          <g key={n.key} filter={active ? "url(#df-glow)" : undefined}>
            <circle
              cx={n.x}
              cy={n.y}
              r={DOT_R}
              fill={pointColor(n.lv, activeLevels)}
              fillOpacity={active ? 0.9 : 0.4}
              stroke={active ? "#fff" : LV_COLORS[n.lv]}
              strokeWidth={active ? 2 : 0.8}
            />
            <text
              x={n.x}
              y={n.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={FS.xxs}
              fontWeight={FW.bold}
              fontFamily="monospace"
              fill={n.lv >= 4 ? "#000" : "#fff"}
              opacity={active ? 1 : 0.6}
            >
              {n.lv}
            </text>
          </g>
        );
      })}

      {/* Convergence node */}
      <g filter={phase === "equal" ? "url(#df-glow)" : undefined}>
        <circle
          cx={90}
          cy={100}
          r={DOT_R + 2}
          fill={pointColor(left, activeLevels)}
          fillOpacity={phase === "equal" ? 0.9 : 0.2}
          stroke={phase === "equal" ? "#fff" : C.textDimmer}
          strokeWidth={phase === "equal" ? 2.5 : 1}
        />
        <text
          x={90}
          y={100}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={FS.xs}
          fontWeight={FW.bold}
          fontFamily="monospace"
          fill={left >= 4 ? "#000" : "#fff"}
          opacity={phase === "equal" ? 1 : 0.4}
        >
          {left}
        </text>
      </g>
      {phase === "equal" && (
        <text x={90} y={H - 2} textAnchor="middle" fontSize={7} fontFamily="monospace" fill={C.accent}>
          = {left} (equal!)
        </text>
      )}
    </svg>
  );
});
