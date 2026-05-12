import type { PointerEvent as ReactPointerEvent, PointerEventHandler } from "react";
import { LEVEL_CANDIDATES, LEVEL_INFO, hue2rgb } from "../color-engine";
import { S_CURSOR_POINTER } from "../styles/shared";
import { C } from "../styles/tokens";
import { CX, CY, WR, wheelPoint, type LinkedVisualizationDot, type LinkedVisualizationHover } from "./linked-visualization-geometry";

interface LinkedVisualizationWheelProps {
  alpha: number;
  radiusFn: (levelIndex: number) => number;
  dots: LinkedVisualizationDot[];
  hueAngle: number;
  hoveredDot: LinkedVisualizationHover | null;
  onHoverDot: (dot: LinkedVisualizationHover | null) => void;
  mode: 0 | 7;
  onPointerDown: PointerEventHandler<SVGGElement>;
}

const DOT_HIT_R = 10;
const DOT_TRANSITION = "r 0.3s, opacity 0.3s, stroke 0.3s, stroke-width 0.3s, fill 0.3s";

export function LinkedVisualizationWheel({
  alpha,
  radiusFn,
  dots,
  hueAngle,
  hoveredDot,
  onHoverDot,
  mode,
  onPointerDown,
}: LinkedVisualizationWheelProps) {
  const wheelPosition = (angle: number, level: number) => wheelPoint(angle, level, alpha, radiusFn);
  const sweepRad = ((hueAngle - alpha - 90) * Math.PI) / 180;

  return (
    <g style={{ cursor: "grab" }} onPointerDown={onPointerDown}>
      <circle cx={CX} cy={CY} r={WR + 14} fill="transparent" />

      {Array.from({ length: 360 }, (_, degree) => {
        const r = ((degree - alpha - 90) * Math.PI) / 180;
        const [cr, cg, cb] = hue2rgb(degree);
        return (
          <line
            key={`h${degree}`}
            x1={CX + 64 * Math.cos(r)}
            y1={CY + 64 * Math.sin(r)}
            x2={CX + 69 * Math.cos(r)}
            y2={CY + 69 * Math.sin(r)}
            stroke={`rgb(${cr},${cg},${cb})`}
            strokeWidth={1.5}
          />
        );
      })}

      {LEVEL_INFO.map((_, level) => {
        const r = radiusFn(level);
        return r > 1 ? (
          <circle key={`g${level}`} cx={CX} cy={CY} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
        ) : null;
      })}

      <line x1={CX - WR - 2} y1={CY} x2={CX + WR + 2} y2={CY} stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />
      <line x1={CX} y1={CY - WR - 2} x2={CX} y2={CY + WR + 2} stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />

      {dots
        .filter((dot) => dot.isActive)
        .map((dot) => {
          const position = wheelPosition(dot.angleDeg, dot.levelIndex);
          const color = `rgb(${dot.rgb.join(",")})`;
          const hovered =
            hoveredDot !== null && hoveredDot.levelIndex === dot.levelIndex && hoveredDot.candidateIndex === dot.candidateIndex;
          const tickLen = hovered ? 5 : 3;

          return (
            <g key={`axt-${dot.levelIndex}-${dot.candidateIndex}`}>
              <line
                x1={CX - tickLen}
                y1={position.y}
                x2={CX + tickLen}
                y2={position.y}
                stroke={color}
                strokeWidth={hovered ? 1.6 : 1.0}
                opacity={hovered ? 1 : 0.6}
              />
              <line
                x1={position.x}
                y1={CY - tickLen}
                x2={position.x}
                y2={CY + tickLen}
                stroke={color}
                strokeWidth={hovered ? 1.6 : 1.0}
                opacity={hovered ? 1 : 0.6}
              />
            </g>
          );
        })}

      <circle
        cx={CX}
        cy={CY}
        r={4}
        fill={mode === 0 ? "#000" : "#fff"}
        stroke={mode === 0 ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
        strokeWidth={0.8}
      />
      <circle cx={CX} cy={CY} r={WR} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} strokeDasharray="2,2" />

      {(
        [
          [1, 6],
          [2, 5],
          [3, 4],
        ] as [number, number][]
      ).flatMap(([fromLevel, toLevel]) =>
        LEVEL_CANDIDATES[fromLevel].map((fromCandidate, candidateIndex) => {
          if (fromCandidate.angle < 0) return null;

          const comp = (fromCandidate.angle + 180) % 360;
          const toCandidateIndex = LEVEL_CANDIDATES[toLevel].findIndex(
            (toCandidate) => Math.abs(((toCandidate.angle - comp + 540) % 360) - 180) < 1,
          );
          if (toCandidateIndex < 0) return null;

          const fromPoint = wheelPosition(fromCandidate.angle, fromLevel);
          const toPoint = wheelPosition(LEVEL_CANDIDATES[toLevel][toCandidateIndex].angle, toLevel);
          return (
            <line
              key={`s${fromLevel}${candidateIndex}`}
              x1={fromPoint.x}
              y1={fromPoint.y}
              x2={toPoint.x}
              y2={toPoint.y}
              stroke={C.accent}
              strokeWidth={0.5}
              strokeDasharray="3,2"
              opacity={0.2}
            />
          );
        }),
      )}

      {(() => {
        const points = dots.filter((dot) => dot.isActive).map((dot) => wheelPosition(dot.angleDeg, dot.levelIndex));
        if (points.length < 2) return null;

        const tension = 0.5;
        let path = `M${points[0].x},${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[Math.max(0, i - 1)];
          const p1 = points[i];
          const p2 = points[i + 1];
          const p3 = points[Math.min(points.length - 1, i + 2)];
          const cp1x = p1.x + (p2.x - p0.x) / (6 / tension);
          const cp1y = p1.y + (p2.y - p0.y) / (6 / tension);
          const cp2x = p2.x - (p3.x - p1.x) / (6 / tension);
          const cp2y = p2.y - (p3.y - p1.y) / (6 / tension);
          path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
        }

        return <path d={path} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.8} />;
      })()}

      {dots.map((dot) => {
        const position = wheelPosition(dot.angleDeg, dot.levelIndex);
        const hovered =
          dot.isActive &&
          hoveredDot !== null &&
          hoveredDot.levelIndex === dot.levelIndex &&
          hoveredDot.candidateIndex === dot.candidateIndex;
        const dimmed = dot.isActive && hoveredDot !== null && !hovered;
        const hoverHandlers = dot.isActive
          ? {
              onPointerEnter: (event: ReactPointerEvent<SVGGElement>) => {
                event.stopPropagation();
                onHoverDot({ levelIndex: dot.levelIndex, candidateIndex: dot.candidateIndex });
              },
              onPointerLeave: () => onHoverDot(null),
            }
          : undefined;

        return (
          <g
            key={`w${dot.levelIndex}${dot.candidateIndex}`}
            style={dot.isActive || hovered ? S_CURSOR_POINTER : undefined}
            {...hoverHandlers}
          >
            {dot.isActive && <circle cx={position.x} cy={position.y} r={DOT_HIT_R} fill="transparent" pointerEvents="all" />}
            <circle
              cx={position.x}
              cy={position.y}
              r={dot.isActive ? (hovered ? 5.5 : 4) : hovered ? 4 : 1.8}
              fill={`rgb(${dot.rgb.join(",")})`}
              stroke={dot.isActive ? "#fff" : hovered ? "#fff" : "rgba(255,255,255,0.15)"}
              strokeWidth={dot.isActive ? (hovered ? 1.4 : 1.0) : hovered ? 1.0 : 0.5}
              opacity={dot.isActive ? (dimmed ? 0.25 : 1) : hovered ? 0.9 : 0.3}
              filter={hovered ? "url(#dot-glow)" : undefined}
              style={{ transition: DOT_TRANSITION }}
            />
          </g>
        );
      })}

      {(() => {
        const x = CX + 69 * Math.cos(sweepRad);
        const y = CY + 69 * Math.sin(sweepRad);
        return (
          <polygon
            points={`${x},${y} ${x + 4 * Math.cos(sweepRad + 2.5)},${y + 4 * Math.sin(sweepRad + 2.5)} ${x + 4 * Math.cos(sweepRad - 2.5)},${y + 4 * Math.sin(sweepRad - 2.5)}`}
            fill="#fff"
          />
        );
      })()}
    </g>
  );
}
