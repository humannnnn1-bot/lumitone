import React, { useRef } from "react";

import { LEVEL_CANDIDATES, findClosestCandidate } from "../color-engine";
import { useTranslation } from "../i18n";
import { C, R, SHADOW, SP } from "../styles/tokens";

export interface GlazeLevelPreview {
  levelIndex: number;
  name: string;
  rgb: readonly [number, number, number];
  hex: string;
}

type GlazeCandidateHover = { levelIndex: number; candidateIndex: number } | null;

interface GlazeCandidateGridProps {
  levelPreview: GlazeLevelPreview[];
  hueAngleDeg: number;
  candidateOverridesByLevel: Map<number, number>;
  selectedLevels: Set<number>;
  hoveredCandidate: GlazeCandidateHover;
  onCandidateOverridesByLevelChange: React.Dispatch<React.SetStateAction<Map<number, number>>>;
  onSelectedLevelsChange: React.Dispatch<React.SetStateAction<Set<number>>>;
  onHoveredCandidateChange: React.Dispatch<React.SetStateAction<GlazeCandidateHover>>;
}

interface GlazeCandidateColumnProps extends Omit<GlazeCandidateGridProps, "levelPreview"> {
  level: GlazeLevelPreview;
}

function candidateHex(rgb: readonly number[]) {
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const GlazeCandidateColumn = React.memo(function GlazeCandidateColumn({
  level,
  hueAngleDeg,
  candidateOverridesByLevel,
  selectedLevels,
  hoveredCandidate,
  onCandidateOverridesByLevelChange,
  onSelectedLevelsChange,
  onHoveredCandidateChange,
}: GlazeCandidateColumnProps) {
  const { t } = useTranslation();
  const swipeStartRef = useRef(0);
  const cands = LEVEL_CANDIDATES[level.levelIndex];
  const hasCands = cands.length > 1;
  const isDirect = candidateOverridesByLevel.has(level.levelIndex);
  const overrideCandidateIndex = candidateOverridesByLevel.get(level.levelIndex);
  const autoCandidateIndex = hasCands ? findClosestCandidate(level.levelIndex, hueAngleDeg) : 0;
  const currentCandidateIndex = isDirect ? overrideCandidateIndex! : autoCandidateIndex;
  const previousCandidateIndex = hasCands ? (currentCandidateIndex - 1 + cands.length) % cands.length : -1;
  const nextCandidateIndex = hasCands ? (currentCandidateIndex + 1) % cands.length : -1;

  const toggleSwatch = (candidateIndex: number) => {
    const deselecting = candidateOverridesByLevel.get(level.levelIndex) === candidateIndex;
    onCandidateOverridesByLevelChange((prev) => {
      const next = new Map(prev);
      if (deselecting) next.delete(level.levelIndex);
      else next.set(level.levelIndex, candidateIndex);
      return next;
    });
    onSelectedLevelsChange((prev) => {
      const next = new Set(prev);
      next.delete(level.levelIndex);
      return next;
    });
    onHoveredCandidateChange(null);
  };

  const cycleCandidate = (dir: number) => {
    const cur = candidateOverridesByLevel.has(level.levelIndex) ? candidateOverridesByLevel.get(level.levelIndex)! : autoCandidateIndex;
    const newIdx = (((cur + dir) % cands.length) + cands.length) % cands.length;
    onCandidateOverridesByLevelChange((prev) => {
      const next = new Map(prev);
      next.set(level.levelIndex, newIdx);
      return next;
    });
    onHoveredCandidateChange({ levelIndex: level.levelIndex, candidateIndex: newIdx });
  };

  const makeSwatch = (candidateIndex: number, size: number) => {
    const cand = cands[candidateIndex];
    const hex = candidateHex(cand.rgb);
    const isSelected = candidateOverridesByLevel.get(level.levelIndex) === candidateIndex;
    const isHovered =
      hoveredCandidate !== null && hoveredCandidate.levelIndex === level.levelIndex && hoveredCandidate.candidateIndex === candidateIndex;
    const angleLabel = `${Math.round(cand.hueAngleDeg)}\u00b0`;
    return (
      <div
        key={candidateIndex}
        role="button"
        tabIndex={0}
        aria-label={t("glaze_level_swatch_aria", level.levelIndex, hex, angleLabel)}
        aria-pressed={isSelected}
        onClick={() => toggleSwatch(candidateIndex)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSwatch(candidateIndex);
          }
        }}
        onPointerEnter={() => onHoveredCandidateChange({ levelIndex: level.levelIndex, candidateIndex })}
        onPointerLeave={() => onHoveredCandidateChange(null)}
        title={`${hex} ${angleLabel}`}
        style={{
          width: size,
          height: size,
          borderRadius: R.md,
          cursor: "pointer",
          background: `rgb(${cand.rgb.join(",")})`,
          border: `2px solid ${isHovered || isSelected ? C.accent : C.border}`,
          boxSizing: "border-box" as const,
          boxShadow: isHovered || isSelected ? SHADOW.glow(C.accent) : "none",
          transition: "box-shadow 0.15s, border-color 0.15s",
        }}
      />
    );
  };

  const handleMainToggle = () => {
    if (!hasCands) return;
    const isSelected = selectedLevels.has(level.levelIndex);
    if (isSelected) {
      onSelectedLevelsChange((prev) => {
        const next = new Set(prev);
        next.delete(level.levelIndex);
        return next;
      });
      onCandidateOverridesByLevelChange((prev) => {
        const next = new Map(prev);
        next.delete(level.levelIndex);
        return next;
      });
      return;
    }

    onSelectedLevelsChange((prev) => {
      const next = new Set(prev);
      next.add(level.levelIndex);
      return next;
    });
    if (!isDirect) {
      onCandidateOverridesByLevelChange((prev) => {
        const next = new Map(prev);
        next.set(level.levelIndex, autoCandidateIndex);
        return next;
      });
    }
  };

  const handleWheel = hasCands
    ? (e: React.WheelEvent) => {
        e.preventDefault();
        cycleCandidate(e.deltaY > 0 ? 1 : -1);
      }
    : undefined;

  const handleTouchStart = hasCands
    ? (e: React.TouchEvent) => {
        swipeStartRef.current = e.touches[0].clientY;
      }
    : undefined;

  const handleTouchEnd = hasCands
    ? (e: React.TouchEvent) => {
        const dy = e.changedTouches[0].clientY - swipeStartRef.current;
        if (Math.abs(dy) > 20) cycleCandidate(dy > 0 ? 1 : -1);
      }
    : undefined;

  const mainCandidateIndex = currentCandidateIndex;
  const mainCand = cands[mainCandidateIndex];
  const mainHex = mainCand ? candidateHex(mainCand.rgb) : "";
  const mainAngleLabel = mainCand ? `${Math.round(mainCand.hueAngleDeg)}\u00b0` : "";
  const isMainHovered =
    hoveredCandidate !== null && hoveredCandidate.levelIndex === level.levelIndex && hoveredCandidate.candidateIndex === mainCandidateIndex;
  const mainSelected = selectedLevels.has(level.levelIndex);

  return (
    <div
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        cursor: hasCands ? "pointer" : "default",
        touchAction: hasCands ? "none" : "auto",
      }}
    >
      {hasCands ? makeSwatch(previousCandidateIndex, 20) : <div style={{ height: 20 }} />}
      <div
        role={hasCands ? "button" : undefined}
        tabIndex={hasCands ? 0 : undefined}
        aria-label={hasCands && mainCand ? t("glaze_level_swatch_aria", level.levelIndex, mainHex, mainAngleLabel) : undefined}
        aria-pressed={hasCands ? mainSelected : undefined}
        onClick={hasCands ? handleMainToggle : undefined}
        onKeyDown={
          hasCands
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleMainToggle();
                }
              }
            : undefined
        }
        onPointerEnter={() => onHoveredCandidateChange({ levelIndex: level.levelIndex, candidateIndex: mainCandidateIndex })}
        onPointerLeave={() => onHoveredCandidateChange(null)}
        title={mainSelected ? t("title_reset_auto") : mainCand ? `${mainHex} ${mainAngleLabel}` : undefined}
        style={{
          width: 28,
          height: 28,
          borderRadius: R.md,
          background: isDirect ? `rgb(${cands[overrideCandidateIndex!]?.rgb.join(",")})` : level.hex,
          border: `2px solid ${isMainHovered || mainSelected ? C.accent : C.border}`,
          boxSizing: "border-box" as const,
          cursor: hasCands ? "pointer" : "default",
          boxShadow: isMainHovered ? SHADOW.glow(C.accent) : "none",
          transition: "box-shadow 0.15s, border-color 0.15s",
        }}
      />
      {hasCands ? makeSwatch(nextCandidateIndex, 20) : <div style={{ height: 20 }} />}
    </div>
  );
});

export const GlazeCandidateGrid = React.memo(function GlazeCandidateGrid({ levelPreview, ...columnProps }: GlazeCandidateGridProps) {
  return (
    <div style={{ display: "flex", gap: SP.sm, justifyContent: "center", alignItems: "center" }}>
      {levelPreview.map((level) => (
        <GlazeCandidateColumn key={level.levelIndex} {...columnProps} level={level} />
      ))}
    </div>
  );
});
