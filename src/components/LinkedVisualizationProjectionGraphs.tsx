import React from "react";
import { C } from "../styles/tokens";
import {
  ACTIVE_LEVELS,
  BH,
  bottomProjectionY,
  BXleft,
  BXright,
  BW,
  BY,
  compositeCosinePath,
  compositeSinePath,
  CX,
  CY,
  HUE_LABELS,
  lumR0,
  RH,
  rightProjectionX,
  RX,
  RW,
  RYbot,
  RYtop,
  WR,
  type LinkedVisualizationDot,
} from "./linked-visualization-geometry";

interface LinkedVisualizationHover {
  levelIndex: number;
  candidateIndex: number;
}

interface ProjectionPaths {
  r0: Record<number, string>;
  r7: Record<number, string>;
}

type DotHandlers = (d: LinkedVisualizationDot) => {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  style: React.CSSProperties;
};

interface ProjectionGraphProps {
  mode: 0 | 7;
  hueAngle: number;
  alpha0: number;
  alpha7: number;
  activeAlpha: number;
  activeRadiusFn: (levelIndex: number) => number;
  activeDots: LinkedVisualizationDot[];
  projectionDots: LinkedVisualizationDot[];
  hoveredDot: LinkedVisualizationHover | null;
  dotHandlers: DotHandlers;
  lvColor: (levelIndex: number) => string;
  paths: ProjectionPaths;
  dotHitR: number;
  dotTransition: string;
}

interface RightProjectionGraphProps extends ProjectionGraphProps {
  axisLabel: string;
  onHuePointerDown: React.PointerEventHandler<SVGRectElement>;
}

interface BottomProjectionGraphProps extends ProjectionGraphProps {
  axisLabel: string;
  onHuePointerDown: React.PointerEventHandler<SVGRectElement>;
}

const rPx = rightProjectionX;
const bPy = bottomProjectionY;
const C2_PAIRS = [
  [1, 6],
  [2, 5],
  [3, 4],
] as const;

export function RightProjectionGraph({
  mode,
  hueAngle,
  alpha0,
  alpha7,
  activeAlpha,
  activeRadiusFn,
  activeDots,
  projectionDots,
  hoveredDot,
  dotHandlers,
  lvColor,
  paths,
  dotHitR,
  dotTransition,
  axisLabel,
  onHuePointerDown,
}: RightProjectionGraphProps) {
  const yellowDot = activeDots.find((d) => d.levelIndex === 6);
  const blueDot = activeDots.find((d) => d.levelIndex === 1);

  return (
    <g>
      <rect
        x={RX}
        y={RYtop}
        width={RW}
        height={RH}
        fill="rgba(255,255,255,0.035)"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={0.5}
        rx={4}
      />
      {HUE_LABELS.map((angleDeg) => (
        <line
          key={`rg${angleDeg}`}
          x1={rPx(angleDeg)}
          y1={RYtop}
          x2={rPx(angleDeg)}
          y2={RYbot}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={0.4}
        />
      ))}
      <line x1={RX} y1={CY} x2={RX + RW} y2={CY} stroke="rgba(255,255,255,0.10)" strokeWidth={0.5} />
      <line
        x1={RX}
        y1={CY}
        x2={RX + RW}
        y2={CY}
        stroke="rgba(255,255,255,0.6)"
        strokeWidth={hoveredDot?.levelIndex === 0 && mode === 0 ? 1.4 : mode === 0 && !hoveredDot ? 1.4 : 0.6}
        opacity={hoveredDot?.levelIndex === 0 && mode === 0 ? 0.9 : hoveredDot ? 0 : mode === 0 ? 0.4 : 0.12}
      />
      <line
        x1={RX}
        y1={CY}
        x2={RX + RW}
        y2={CY}
        stroke="#fff"
        strokeWidth={hoveredDot?.levelIndex === 7 && mode === 7 ? 1.4 : mode === 7 && !hoveredDot ? 1.4 : 0.6}
        opacity={hoveredDot?.levelIndex === 7 && mode === 7 ? 0.9 : hoveredDot ? 0 : mode === 7 ? 0.4 : 0.12}
      />
      <path
        d={paths.r0[7]}
        fill="none"
        stroke="#fff"
        strokeWidth={mode === 0 ? 1.4 : 0.6}
        opacity={hoveredDot?.levelIndex === 7 && mode === 0 ? 0.9 : hoveredDot ? 0 : mode === 0 ? 0.5 : 0.12}
      />
      <path
        d={paths.r7[0]}
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth={mode === 7 ? 1.4 : 0.6}
        opacity={hoveredDot?.levelIndex === 0 && mode === 7 ? 0.9 : hoveredDot ? 0 : mode === 7 ? 0.5 : 0.12}
      />
      {yellowDot &&
        (() => {
          const hovL7m0 = hoveredDot?.levelIndex === 7 && mode === 0;
          const rad = ((yellowDot.angleDeg - alpha0 - 90) * Math.PI) / 180;
          return (
            <circle
              cx={rPx(yellowDot.angleDeg)}
              cy={CY + WR * Math.sin(rad)}
              r={hovL7m0 ? 5.5 : 4}
              fill="#fff"
              stroke={hovL7m0 ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)"}
              strokeWidth={hovL7m0 ? 1.2 : 0.8}
              opacity={hovL7m0 ? 1 : hoveredDot ? 0.15 : mode === 0 ? 0.8 : 0.15}
              style={{ transition: dotTransition }}
            />
          );
        })()}
      {blueDot &&
        (() => {
          const hovL0m0 = hoveredDot?.levelIndex === 0 && mode === 0;
          return (
            <circle
              cx={rPx(blueDot.angleDeg)}
              cy={CY}
              r={hovL0m0 ? 5.5 : 4}
              fill="#222"
              stroke={hovL0m0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)"}
              strokeWidth={hovL0m0 ? 1.2 : 0.8}
              opacity={hovL0m0 ? 1 : hoveredDot ? 0.15 : mode === 0 ? 0.8 : 0.15}
              style={{ transition: dotTransition }}
            />
          );
        })()}
      {blueDot &&
        (() => {
          const hovL0m7 = hoveredDot?.levelIndex === 0 && mode === 7;
          const rad = ((blueDot.angleDeg - alpha7 - 90) * Math.PI) / 180;
          return (
            <circle
              cx={rPx(blueDot.angleDeg)}
              cy={CY + WR * Math.sin(rad)}
              r={hovL0m7 ? 5.5 : 4}
              fill="#222"
              stroke={hovL0m7 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)"}
              strokeWidth={hovL0m7 ? 1.2 : 0.8}
              opacity={hovL0m7 ? 1 : hoveredDot ? 0.15 : mode === 7 ? 0.8 : 0.15}
              style={{ transition: dotTransition }}
            />
          );
        })()}
      {yellowDot &&
        (() => {
          const hovL7m7 = hoveredDot?.levelIndex === 7 && mode === 7;
          return (
            <circle
              cx={rPx(yellowDot.angleDeg)}
              cy={CY}
              r={hovL7m7 ? 5.5 : 4}
              fill="#fff"
              stroke={hovL7m7 ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)"}
              strokeWidth={hovL7m7 ? 1.2 : 0.8}
              opacity={hovL7m7 ? 1 : hoveredDot ? 0.15 : mode === 7 ? 0.8 : 0.15}
              style={{ transition: dotTransition }}
            />
          );
        })()}
      <text x={RX + RW / 2} y={RYtop - 4} fontSize={9} fill={C.textMuted} textAnchor="middle" fontStyle="italic">
        {axisLabel}
      </text>
      {HUE_LABELS.map((angleDeg) => (
        <text key={`ra${angleDeg}`} x={rPx(angleDeg)} y={RYbot + 12} fontSize={8} fill={C.textMuted} textAnchor="middle">
          {angleDeg}°
        </text>
      ))}
      {ACTIVE_LEVELS.map((levelIndex) => (
        <path
          key={`rs0-${levelIndex}`}
          d={paths.r0[levelIndex]}
          fill="none"
          stroke={lvColor(levelIndex)}
          strokeWidth={mode === 0 ? 1.8 : 0.8}
          opacity={hoveredDot && mode === 0 ? (hoveredDot.levelIndex === levelIndex ? 0.9 : 0.15) : mode === 0 ? 0.65 : 0.2}
        />
      ))}
      {ACTIVE_LEVELS.map((levelIndex) => (
        <path
          key={`rs7-${levelIndex}`}
          d={paths.r7[levelIndex]}
          fill="none"
          stroke={lvColor(levelIndex)}
          strokeWidth={mode === 7 ? 1.8 : 0.8}
          opacity={hoveredDot && mode === 7 ? (hoveredDot.levelIndex === levelIndex ? 0.9 : 0.15) : mode === 7 ? 0.65 : 0.2}
        />
      ))}
      {C2_PAIRS.map(([levelIndex, pairLevel]) => {
        const rA = lumR0(levelIndex);
        if (rA < 1) return null;
        const colA = activeDots.find((d) => d.levelIndex === levelIndex);
        const colB = activeDots.find((d) => d.levelIndex === pairLevel);
        const col =
          colA && colB
            ? `rgb(${Math.round((colA.rgb[0] + colB.rgb[0]) / 2)},${Math.round((colA.rgb[1] + colB.rgb[1]) / 2)},${Math.round((colA.rgb[2] + colB.rgb[2]) / 2)})`
            : "rgba(255,255,255,0.5)";
        return (
          <path
            key={`comp-s-${levelIndex}-${pairLevel}`}
            d={compositeSinePath(rA, alpha0, alpha7)}
            fill="none"
            stroke={col}
            strokeWidth={1.2}
            opacity={0.5}
            strokeDasharray="4,3"
          />
        );
      })}
      <line x1={rPx(hueAngle)} y1={RYtop} x2={rPx(hueAngle)} y2={RYbot} stroke={C.accent} strokeWidth={1} opacity={0.5} />
      <rect
        x={rPx(hueAngle) - 6}
        y={RYtop - 5}
        width={12}
        height={RH + 10}
        fill="transparent"
        style={{ cursor: "ew-resize" }}
        onPointerDown={onHuePointerDown}
      />
      {projectionDots.map((d) => {
        const rad = ((d.angleDeg - activeAlpha - 90) * Math.PI) / 180;
        const y = CY + activeRadiusFn(d.levelIndex) * Math.sin(rad);
        const hov = hoveredDot !== null && hoveredDot.levelIndex === d.levelIndex && hoveredDot.candidateIndex === d.candidateIndex;
        const dimmed = d.isActive && hoveredDot !== null && !hov;
        return (
          <g key={`rproj-${d.levelIndex}-${d.candidateIndex}`} {...(d.isActive ? dotHandlers(d) : {})}>
            {d.isActive && <circle cx={rPx(d.angleDeg)} cy={y} r={dotHitR} fill="transparent" pointerEvents="all" />}
            <circle
              cx={rPx(d.angleDeg)}
              cy={y}
              r={d.isActive ? (hov ? 5.5 : 4) : hov ? 4 : 1.8}
              fill={`rgb(${d.rgb.join(",")})`}
              stroke={d.isActive ? "#fff" : hov ? "#fff" : "rgba(255,255,255,0.15)"}
              strokeWidth={d.isActive ? (hov ? 1.4 : 1.0) : hov ? 1.0 : 0.5}
              opacity={d.isActive ? (dimmed ? 0.25 : 1) : hov ? 0.9 : 0.3}
              filter={hov ? "url(#dot-glow)" : undefined}
              style={{ transition: dotTransition }}
            />
          </g>
        );
      })}
    </g>
  );
}

export function BottomProjectionGraph({
  mode,
  hueAngle,
  alpha0,
  alpha7,
  activeAlpha,
  activeRadiusFn,
  activeDots,
  projectionDots,
  hoveredDot,
  dotHandlers,
  lvColor,
  paths,
  dotHitR,
  dotTransition,
  axisLabel,
  onHuePointerDown,
}: BottomProjectionGraphProps) {
  const yellowDot = activeDots.find((d) => d.levelIndex === 6);
  const blueDot = activeDots.find((d) => d.levelIndex === 1);

  return (
    <g>
      <rect
        x={BXleft}
        y={BY}
        width={BW}
        height={BH}
        fill="rgba(255,255,255,0.035)"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={0.5}
        rx={4}
      />
      {HUE_LABELS.map((angleDeg) => (
        <line
          key={`bg${angleDeg}`}
          x1={BXleft}
          y1={bPy(angleDeg)}
          x2={BXright}
          y2={bPy(angleDeg)}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={0.4}
        />
      ))}
      <line x1={CX} y1={BY} x2={CX} y2={BY + BH} stroke="rgba(255,255,255,0.10)" strokeWidth={0.5} />
      <line
        x1={CX}
        y1={BY}
        x2={CX}
        y2={BY + BH}
        stroke="rgba(255,255,255,0.6)"
        strokeWidth={hoveredDot?.levelIndex === 0 && mode === 0 ? 1.4 : mode === 0 && !hoveredDot ? 1.4 : 0.6}
        opacity={hoveredDot?.levelIndex === 0 && mode === 0 ? 0.9 : hoveredDot ? 0 : mode === 0 ? 0.4 : 0.12}
      />
      <line
        x1={CX}
        y1={BY}
        x2={CX}
        y2={BY + BH}
        stroke="#fff"
        strokeWidth={hoveredDot?.levelIndex === 7 && mode === 7 ? 1.4 : mode === 7 && !hoveredDot ? 1.4 : 0.6}
        opacity={hoveredDot?.levelIndex === 7 && mode === 7 ? 0.9 : hoveredDot ? 0 : mode === 7 ? 0.4 : 0.12}
      />
      <path
        d={paths.r0[7]}
        fill="none"
        stroke="#fff"
        strokeWidth={mode === 0 ? 1.4 : 0.6}
        opacity={hoveredDot?.levelIndex === 7 && mode === 0 ? 0.9 : hoveredDot ? 0 : mode === 0 ? 0.5 : 0.12}
      />
      <path
        d={paths.r7[0]}
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth={mode === 7 ? 1.4 : 0.6}
        opacity={hoveredDot?.levelIndex === 0 && mode === 7 ? 0.9 : hoveredDot ? 0 : mode === 7 ? 0.5 : 0.12}
      />
      {yellowDot &&
        (() => {
          const hovL7m0 = hoveredDot?.levelIndex === 7 && mode === 0;
          const rad = ((yellowDot.angleDeg - alpha0 - 90) * Math.PI) / 180;
          return (
            <circle
              cx={CX + WR * Math.cos(rad)}
              cy={bPy(yellowDot.angleDeg)}
              r={hovL7m0 ? 5.5 : 4}
              fill="#fff"
              stroke={hovL7m0 ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)"}
              strokeWidth={hovL7m0 ? 1.2 : 0.8}
              opacity={hovL7m0 ? 1 : hoveredDot ? 0.15 : mode === 0 ? 0.8 : 0.15}
              style={{ transition: dotTransition }}
            />
          );
        })()}
      {blueDot &&
        (() => {
          const hovL0m0 = hoveredDot?.levelIndex === 0 && mode === 0;
          return (
            <circle
              cx={CX}
              cy={bPy(blueDot.angleDeg)}
              r={hovL0m0 ? 5.5 : 4}
              fill="#222"
              stroke={hovL0m0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)"}
              strokeWidth={hovL0m0 ? 1.2 : 0.8}
              opacity={hovL0m0 ? 1 : hoveredDot ? 0.15 : mode === 0 ? 0.8 : 0.15}
              style={{ transition: dotTransition }}
            />
          );
        })()}
      {blueDot &&
        (() => {
          const hovL0m7 = hoveredDot?.levelIndex === 0 && mode === 7;
          const rad = ((blueDot.angleDeg - alpha7 - 90) * Math.PI) / 180;
          return (
            <circle
              cx={CX + WR * Math.cos(rad)}
              cy={bPy(blueDot.angleDeg)}
              r={hovL0m7 ? 5.5 : 4}
              fill="#222"
              stroke={hovL0m7 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)"}
              strokeWidth={hovL0m7 ? 1.2 : 0.8}
              opacity={hovL0m7 ? 1 : hoveredDot ? 0.15 : mode === 7 ? 0.8 : 0.15}
              style={{ transition: dotTransition }}
            />
          );
        })()}
      {yellowDot &&
        (() => {
          const hovL7m7 = hoveredDot?.levelIndex === 7 && mode === 7;
          return (
            <circle
              cx={CX}
              cy={bPy(yellowDot.angleDeg)}
              r={hovL7m7 ? 5.5 : 4}
              fill="#fff"
              stroke={hovL7m7 ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)"}
              strokeWidth={hovL7m7 ? 1.2 : 0.8}
              opacity={hovL7m7 ? 1 : hoveredDot ? 0.15 : mode === 7 ? 0.8 : 0.15}
              style={{ transition: dotTransition }}
            />
          );
        })()}
      <text x={CX} y={BY + BH + 12} fontSize={9} fill={C.textMuted} textAnchor="middle" fontStyle="italic">
        {axisLabel}
      </text>
      {HUE_LABELS.map((angleDeg) => (
        <text
          key={`ba${angleDeg}`}
          x={BXleft - 4}
          y={bPy(angleDeg)}
          fontSize={8}
          fill={C.textMuted}
          textAnchor="end"
          dominantBaseline="middle"
        >
          {angleDeg}°
        </text>
      ))}
      <line x1={BXleft} y1={bPy(hueAngle)} x2={BXright} y2={bPy(hueAngle)} stroke={C.accent} strokeWidth={1} opacity={0.5} />
      <rect
        x={BXleft - 5}
        y={bPy(hueAngle) - 6}
        width={BW + 10}
        height={12}
        fill="transparent"
        style={{ cursor: "ns-resize" }}
        onPointerDown={onHuePointerDown}
      />
      {ACTIVE_LEVELS.map((levelIndex) => (
        <path
          key={`bc0-${levelIndex}`}
          d={paths.r0[levelIndex]}
          fill="none"
          stroke={lvColor(levelIndex)}
          strokeWidth={mode === 0 ? 1.8 : 0.8}
          opacity={hoveredDot && mode === 0 ? (hoveredDot.levelIndex === levelIndex ? 0.9 : 0.15) : mode === 0 ? 0.65 : 0.2}
        />
      ))}
      {ACTIVE_LEVELS.map((levelIndex) => (
        <path
          key={`bc7-${levelIndex}`}
          d={paths.r7[levelIndex]}
          fill="none"
          stroke={lvColor(levelIndex)}
          strokeWidth={mode === 7 ? 1.8 : 0.8}
          opacity={hoveredDot && mode === 7 ? (hoveredDot.levelIndex === levelIndex ? 0.9 : 0.15) : mode === 7 ? 0.65 : 0.2}
        />
      ))}
      {C2_PAIRS.map(([levelIndex, pairLevel]) => {
        const rA = lumR0(levelIndex);
        if (rA < 1) return null;
        const colA = activeDots.find((d) => d.levelIndex === levelIndex);
        const colB = activeDots.find((d) => d.levelIndex === pairLevel);
        const col =
          colA && colB
            ? `rgb(${Math.round((colA.rgb[0] + colB.rgb[0]) / 2)},${Math.round((colA.rgb[1] + colB.rgb[1]) / 2)},${Math.round((colA.rgb[2] + colB.rgb[2]) / 2)})`
            : "rgba(255,255,255,0.5)";
        return (
          <path
            key={`comp-c-${levelIndex}-${pairLevel}`}
            d={compositeCosinePath(rA, alpha0, alpha7)}
            fill="none"
            stroke={col}
            strokeWidth={1.2}
            opacity={0.5}
            strokeDasharray="4,3"
          />
        );
      })}
      {projectionDots.map((d) => {
        const rad = ((d.angleDeg - activeAlpha - 90) * Math.PI) / 180;
        const x = CX + activeRadiusFn(d.levelIndex) * Math.cos(rad);
        const hov = hoveredDot !== null && hoveredDot.levelIndex === d.levelIndex && hoveredDot.candidateIndex === d.candidateIndex;
        const dimmed = d.isActive && hoveredDot !== null && !hov;
        return (
          <g key={`bproj-${d.levelIndex}-${d.candidateIndex}`} {...(d.isActive ? dotHandlers(d) : {})}>
            {d.isActive && <circle cx={x} cy={bPy(d.angleDeg)} r={dotHitR} fill="transparent" pointerEvents="all" />}
            <circle
              cx={x}
              cy={bPy(d.angleDeg)}
              r={d.isActive ? (hov ? 5.5 : 4) : hov ? 4 : 1.8}
              fill={`rgb(${d.rgb.join(",")})`}
              stroke={d.isActive ? "#fff" : hov ? "#fff" : "rgba(255,255,255,0.15)"}
              strokeWidth={d.isActive ? (hov ? 1.4 : 1.0) : hov ? 1.0 : 0.5}
              opacity={d.isActive ? (dimmed ? 0.25 : 1) : hov ? 0.9 : 0.3}
              filter={hov ? "url(#dot-glow)" : undefined}
              style={{ transition: dotTransition }}
            />
          </g>
        );
      })}
    </g>
  );
}
