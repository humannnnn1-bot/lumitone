import { angleToFreq, freqToNote, type ScaleMode } from "../../data/music-frequency";
import { C } from "../../styles/tokens";
import { S_CURSOR_POINTER } from "../../styles/shared";
import type { LinkedVisualizationDot, LinkedVisualizationOverlayContext } from "../LinkedVisualization";

interface RatioMember {
  lv: number;
  rgb: [number, number, number];
  ci: number;
}

interface RatioEntry {
  label: string;
  value: string;
  dim?: boolean | undefined;
  color?: string | undefined;
  lv?: number | undefined;
  ci?: number | undefined;
  members?: RatioMember[] | undefined;
}

interface IntervalRatiosProps extends LinkedVisualizationOverlayContext {
  scaleMode: ScaleMode;
}

const TITLE_FONT_SIZE = 15;
const ROW_FONT_SIZE = 14;
const LABEL_W = 32;
const NOTE_NAMES = ["C", "C\u266f", "D", "D\u266f", "E", "F", "F\u266f", "G", "G\u266f", "A", "A\u266f", "B"] as const;
const JI_RATIOS = [1, 8 / 7, 7 / 5, 8 / 5, 2] as const;
const JI_RATIO_LABELS = ["1:1", "8:7", "7:5", "8:5", "2:1"] as const;
const JI_ANGLES = [0, 72, 144, 216, 288] as const;

function notePad3(hz: number): string {
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  const n = NOTE_NAMES[((midi % 12) + 12) % 12];
  const oct = Math.floor(midi / 12) - 1;
  return (n.length === 1 ? n + " " : n) + oct;
}

function buildRatioRows(
  activeDots: LinkedVisualizationDot[],
  activeAlpha: number,
  scaleMode: ScaleMode,
): { title: string; rows: RatioEntry[] } {
  const rows: RatioEntry[] = [];
  const levelFreq = (d: LinkedVisualizationDot) => angleToFreq(d.a + activeAlpha, scaleMode);

  if (scaleMode === "ji") {
    const chromatic = activeDots.filter((d) => d.lv !== 0 && d.lv !== 7).sort((a, b) => a.lv - b.lv);
    for (const d of chromatic) {
      const live = (((d.a + activeAlpha) % 360) + 360) % 360;
      let snapIdx = 0;
      let minDist = 360;
      for (let j = 0; j < JI_ANGLES.length; j++) {
        const di = Math.min(Math.abs(live - JI_ANGLES[j]), 360 - Math.abs(live - JI_ANGLES[j]));
        if (di < minDist) {
          minDist = di;
          snapIdx = j;
        }
      }
      const hz = 220 * JI_RATIOS[snapIdx];
      rows.push({
        label: `L${d.lv}`,
        value: `${notePad3(hz)} ${String(Math.round(hz)).padStart(3, " ")}Hz ${JI_RATIO_LABELS[snapIdx]}`,
        color: `rgb(${d.rgb.join(",")})`,
        lv: d.lv,
        ci: d.ci,
      });
    }
    rows.push({ label: "", value: "" });
    rows.push({ label: "\u2190", value: "palindrome \u2192", dim: true });
    rows.push({ label: "", value: "8:7 \u00b7 7:5 \u00b7 8:5 \u00b7 2:1", dim: true });
    rows.push({ label: "", value: "2:1 \u00b7 8:5 \u00b7 7:5 \u00b7 8:7", dim: true });
    return { title: "Palindromic JI", rows };
  }

  if (scaleMode === "12tet") {
    const sorted = [...activeDots].sort((a, b) => a.lv - b.lv);
    for (const d of sorted) {
      const f = levelFreq(d);
      const hz = Math.round(f);
      const midi = Math.round(69 + 12 * Math.log2(f / 440));
      const name = NOTE_NAMES[((midi % 12) + 12) % 12];
      const octave = Math.floor(midi / 12) - 1;
      const noteStr = (name.length === 1 ? name + " " : name) + octave;
      rows.push({
        label: `L${d.lv}`,
        value: `${noteStr}  ${hz}Hz`,
        color: `rgb(${d.rgb.join(",")})`,
        lv: d.lv,
        ci: d.ci,
      });
    }
    return { title: "12-TET (Equal)", rows };
  }

  const isOcta = scaleMode === "octatonic";
  const steps = isOcta ? [0, 1, 3, 4, 6, 7, 9, 10] : [0, 2, 4, 5, 7, 9, 11];
  const n = steps.length;
  const perDegree: RatioMember[][] = steps.map(() => []);
  for (const d of activeDots) {
    if (d.lv === 0 || d.lv === 7) continue;
    const norm = (((d.a + activeAlpha) % 360) + 360) % 360;
    const idx = Math.round((norm / 360) * n) % n;
    perDegree[idx].push({ lv: d.lv, rgb: d.rgb, ci: d.ci });
  }
  for (let i = 0; i < n; i++) {
    const hz = 261.63 * Math.pow(2, steps[i] / 12);
    const note = freqToNote(hz);
    const next = steps[(i + 1) % n];
    const diff = (next - steps[i] + 12) % 12;
    rows.push({
      label: note,
      value: `${Math.round(hz)}Hz · \u0394${diff}`,
      members: perDegree[i].length > 0 ? perDegree[i] : undefined,
    });
  }
  return { title: isOcta ? "Octatonic Scale" : "Diatonic (7-note)", rows };
}

export function IntervalRatios({
  activeDots,
  activeAlpha,
  hoveredDot,
  setHoveredDot,
  x,
  y,
  rowHeight,
  width,
  scaleMode,
}: IntervalRatiosProps) {
  const { title, rows } = buildRatioRows(activeDots, activeAlpha, scaleMode);
  const swatchSize = ROW_FONT_SIZE - 2;
  const memberSq = 12;
  const memberGap = 2;

  return (
    <g>
      <text x={x} y={y} fontSize={TITLE_FONT_SIZE} fill={C.accent} fontWeight="bold" fontFamily="var(--font-mono)">
        {title}
      </text>
      {rows.map((r, i) => {
        const isHovered = hoveredDot !== null && r.lv != null && hoveredDot.lv === r.lv;
        const isDimmed = hoveredDot !== null && r.lv != null && !isHovered;
        const textFill = r.dim ? C.textDimmer : isHovered ? "#fff" : C.textDim;
        const textX = r.color ? x + swatchSize + 4 : x;
        const rowY = y + (i + 1) * rowHeight;
        return (
          <g
            key={i}
            style={{ cursor: r.lv != null ? "pointer" : undefined }}
            opacity={isDimmed ? 0.3 : 1}
            onPointerEnter={r.lv != null && r.ci != null ? () => setHoveredDot({ lv: r.lv!, ci: r.ci! }) : undefined}
            onPointerLeave={r.lv != null ? () => setHoveredDot(null) : undefined}
          >
            {r.lv != null && <rect x={x - 2} y={rowY - ROW_FONT_SIZE} width={width - x} height={rowHeight} fill="transparent" />}
            {r.color && <rect x={x} y={rowY - swatchSize} width={swatchSize} height={swatchSize} rx={2} fill={r.color} />}
            <text
              x={textX}
              y={rowY}
              fontSize={ROW_FONT_SIZE}
              fill={textFill}
              fontWeight={r.dim ? "normal" : "bold"}
              fontFamily="var(--font-sans)"
            >
              {r.label}
            </text>
            <text
              x={textX + LABEL_W}
              y={rowY}
              fontSize={ROW_FONT_SIZE}
              fill={textFill}
              fontFamily="var(--font-mono)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {r.value}
            </text>
            {r.members?.map((m, mi) => {
              const mx = width - 4 - (r.members!.length - mi) * (memberSq + memberGap);
              const my = rowY - memberSq;
              const isMHovered = hoveredDot !== null && hoveredDot.lv === m.lv;
              return (
                <g
                  key={`m${mi}`}
                  style={S_CURSOR_POINTER}
                  onPointerEnter={() => setHoveredDot({ lv: m.lv, ci: m.ci })}
                  onPointerLeave={() => setHoveredDot(null)}
                >
                  <rect
                    x={mx}
                    y={my}
                    width={memberSq}
                    height={memberSq}
                    rx={2}
                    fill={`rgb(${m.rgb.join(",")})`}
                    stroke={isMHovered ? "#fff" : C.border}
                    strokeWidth={isMHovered ? 1.5 : 0.5}
                  />
                  <text x={mx + memberSq / 2} y={my - 1} fontSize={8} fill={C.textDim} textAnchor="middle" fontFamily="var(--font-sans)">
                    {m.lv}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}
