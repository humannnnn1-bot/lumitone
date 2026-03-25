import React, { useState, useMemo, useCallback, memo } from "react";
import { LEVEL_CANDIDATES } from "../color-engine";
import { NUM_VERTICES } from "../constants";
import { HEX_VERTICES, HEX_EDGES, HEX_EDGE_COLORS, HEX_VERTEX_ALTS, HEX_EDGE_ALTS, HEX_DOTS, HEX_CX, HEX_CY, HEX_R, HEX_VP } from "../hex-data";
import type { ColorAction } from "../color-reducer";
import { useTranslation } from "../i18n";
import { C, FS, FW, O } from "../tokens";

interface Props {
  cc: number[];
  dispatch: React.Dispatch<ColorAction>;
  hist: number[];
  total: number;
  locked: boolean[];
  onToggleLock: (lv: number) => void;
}

export const HexDiag = memo(function HexDiag({ cc, dispatch, hist, total, locked, onToggleLock }: Props) {
  const { t } = useTranslation();
  const [hl, setHl] = useState<number | null>(null);
  const [focusedLv, setFocusedLv] = useState<number | null>(null);
  const vp = HEX_VP;
  const sel = (lv: number, ai: number) => dispatch({ type: "set_color", lv, idx: ai });
  const isA = (lv: number, ai: number) => (cc[lv] % LEVEL_CANDIDATES[lv].length) === ai;

  // Event delegation for mouse enter/leave on SVG groups with data-lv attribute
  const onSvgMouseOver = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const g = (e.target as SVGElement).closest<SVGElement>("g[data-lv]");
    if (g) setHl(Number(g.dataset.lv));
  }, []);
  const onSvgMouseOut = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const g = (e.target as SVGElement).closest<SVGElement>("g[data-lv]");
    if (g) setHl(null);
  }, []);
  const dR = (lv: number, vertex: boolean, active: boolean) => {
    const mn = vertex ? 8 : 4;
    if (!active) return mn;
    const base = vertex ? 15 : 8, mx = vertex ? 50 : 30;
    const r = total > 0 ? hist[lv] / total : 0;
    return Math.min(mx, Math.max(mn, base * (.5 + r * 10)));
  };
  const { cp } = useMemo(() => {
    const points = HEX_DOTS.filter(d => isA(d.lv, d.alt)).map(d => {
      let pos: { x: number; y: number };
      if (d.vi >= 0) pos = vp[d.vi];
      else {
        const e = HEX_EDGES[d.ei], p0 = vp[e.f], p1 = vp[e.t % NUM_VERTICES];
        const ts = Math.abs(HEX_VERTICES[e.f].lv - HEX_VERTICES[e.t % NUM_VERTICES].lv);
        if (ts === 0) return null;
        const frac = (d.si + 1) / ts;
        pos = { x: p0.x + (p1.x - p0.x) * frac, y: p0.y + (p1.y - p0.y) * frac };
      }
      return { ...pos, ang: Math.atan2(pos.y - HEX_CY, pos.x - HEX_CX) };
    }).filter((p): p is NonNullable<typeof p> => p !== null).sort((a, b) => a.ang - b.ang);
    const path = points.length > 1 ? points.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ") + "Z" : "";
    return { actP: points, cp: path };
  }, [cc, vp, isA]); // eslint-disable-line react-hooks/exhaustive-deps -- isA depends on cc

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox="0 0 400 440" style={{ width: "100%", maxWidth: 400 }} role="img" aria-label={t("hex_diagram_label")}
        onMouseOver={onSvgMouseOver} onMouseOut={onSvgMouseOut}>
        <rect width={400} height={440} fill={C.bgPanel} rx={6} />
        {HEX_VERTICES.map((_, i) => {
          const j = (i + 1) % NUM_VERTICES;
          return <line key={"e" + i} x1={vp[i].x} y1={vp[i].y} x2={vp[j].x} y2={vp[j].y} stroke={C.borderAlt} strokeWidth={1.5} />;
        })}
        {cp && <path d={cp} fill={C.svgFillFaint} stroke={C.svgStrokeLight} strokeWidth={1.5} strokeDasharray="6,4" />}
        {HEX_EDGES.map((e, ei) => {
          const p0 = vp[e.f], p1 = vp[e.t % NUM_VERTICES];
          const ts = Math.abs(HEX_VERTICES[e.f].lv - HEX_VERTICES[e.t % NUM_VERTICES].lv);
          if (ts === 0) return null;
          return e.lv.map((lv, li) => {
            const frac = (li + 1) / ts, x = p0.x + (p1.x - p0.x) * frac, y = p0.y + (p1.y - p0.y) * frac;
            const dc = HEX_EDGE_COLORS[ei][li].hex, ai = HEX_EDGE_ALTS[ei][li], act = isA(lv, ai), r = dR(lv, false, act);
            const hov = hl === lv;
            return (
              <g key={"m" + ei + li} data-lv={lv}
                onFocus={() => { setHl(lv); setFocusedLv(lv); }} onBlur={() => { setHl(null); setFocusedLv(null); }}
                onClick={() => { if (!locked[lv]) sel(lv, ai); }}
                onContextMenu={(e) => { e.preventDefault(); onToggleLock(lv); }}
                style={{ cursor: "pointer" }}
                tabIndex={0} onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); sel(lv, ai); } }}
                role="button" aria-label={t("hex_edge_label", lv, dc)}>
                {focusedLv === lv && <circle cx={x} cy={y} r={r + 8} fill="none" stroke={C.accent} strokeWidth={2} />}
                {act && <circle cx={x} cy={y} r={r + 5} fill="none" stroke={C.textWhite} strokeWidth={1.5} strokeDasharray="3,2" opacity={O.soft} />}
                {hov && !act && <circle cx={x} cy={y} r={r + 4} fill="none" stroke={C.svgStrokeHover} strokeWidth={1} />}
                <circle cx={x} cy={y} r={r} fill={dc} stroke={act ? C.textWhite : dc} strokeWidth={act ? 2.5 : 1} fillOpacity={O.soft} />
                <text x={x} y={y + 3.5} textAnchor="middle" fontSize={Math.max(FS.xxs, r * .9)} fontWeight={FW.bold} fontFamily="monospace" fill={lv >= 4 ? "#000" : C.textWhite}>{lv}</text>
                {locked[lv] && <text x={x} y={y - r - 3} textAnchor="middle" fontSize={FS.sm} fill={C.warning}>&#x1F512;</text>}
              </g>);
          });
        })}
        {HEX_VERTICES.map((v, i) => {
          const p = vp[i], ai = HEX_VERTEX_ALTS[i], act = isA(v.lv, ai);
          const la = v.a * Math.PI / 180, lx = HEX_CX + (HEX_R + 28) * Math.cos(la), ly = HEX_CY + (HEX_R + 28) * Math.sin(la);
          const r = dR(v.lv, true, act);
          const hov = hl === v.lv;
          return (
            <g key={"v" + i} data-lv={v.lv}
              onFocus={() => { setHl(v.lv); setFocusedLv(v.lv); }} onBlur={() => { setHl(null); setFocusedLv(null); }}
              onClick={() => { if (!locked[v.lv]) sel(v.lv, ai); }}
              onContextMenu={(e) => { e.preventDefault(); onToggleLock(v.lv); }}
              style={{ cursor: "pointer" }}
              tabIndex={0} onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); sel(v.lv, ai); } }}
              role="button" aria-label={t("hex_vertex_label", v.c, v.lv)}>
              {focusedLv === v.lv && <circle cx={p.x} cy={p.y} r={r + 8} fill="none" stroke={C.accent} strokeWidth={2} />}
              {act && <circle cx={p.x} cy={p.y} r={r + 5} fill="none" stroke={C.textWhite} strokeWidth={1.5} strokeDasharray="4,3" opacity={O.soft} />}
              {hov && !act && <circle cx={p.x} cy={p.y} r={r + 4} fill="none" stroke={C.svgStrokeHover} strokeWidth={1} />}
              <circle cx={p.x} cy={p.y} r={r} fill={v.rgb} stroke={act ? C.textWhite : v.rgb} strokeWidth={act ? 3 : 1} fillOpacity={O.soft} />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={Math.max(FS.sm, r * .7)} fontWeight={900} fontFamily="monospace" fill={v.lv >= 4 ? "#000" : C.textWhite}>{v.lv}</text>
              <text x={lx} y={ly + 4} textAnchor="middle" fontSize={FS.lg} fontWeight={FW.bold} fontFamily="monospace" fill={v.rgb} opacity={O.strong}>{v.c}</text>
              {locked[v.lv] && <text x={p.x} y={p.y - r - 4} textAnchor="middle" fontSize={FS.lg} fill={C.warning}>&#x1F512;</text>}
            </g>);
        })}
        <text x={200} y={420} textAnchor="middle" fontSize={FS.md} fontFamily="monospace" fill={C.textDimmer}>{t("hex_luminance_seq")}</text>
      </svg>
    </div>
  );
}, (prev, next) => {
  if (prev.total !== next.total) return false;
  for (let i = 0; i < 8; i++) {
    if (prev.cc[i] !== next.cc[i]) return false;
    if (prev.hist[i] !== next.hist[i]) return false;
    if (prev.locked[i] !== next.locked[i]) return false;
  }
  return true;
});
