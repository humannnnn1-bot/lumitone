import React, { useRef } from "react";
import { LEVEL_CANDIDATES, findClosestCandidate } from "../../color-engine";
import { useTranslation } from "../../i18n";
import { C, R, SHADOW, SP } from "../../styles/tokens";
import type { MusicCandidateHover, MusicLevelPreview } from "../../music/types";

interface MusicLevelCandidateGridProps {
  levelPreview: MusicLevelPreview[];
  hueAngle: number;
  candidateOverridesByLevel: Map<number, number>;
  selectedLevels: Set<number>;
  burstHighlight: Set<number>;
  hoveredCandidate: MusicCandidateHover;
  onCandidateOverridesByLevelChange: React.Dispatch<React.SetStateAction<Map<number, number>>>;
  onSelectedLevelsChange: React.Dispatch<React.SetStateAction<Set<number>>>;
  onHoveredCandidateChange: (candidate: MusicCandidateHover) => void;
  onBlockClick: (levelIndex: number, hueAngleDeg: number) => void;
}

interface MusicLevelCandidateColumnProps extends Omit<MusicLevelCandidateGridProps, "levelPreview"> {
  level: MusicLevelPreview;
}

function candidateHex(rgb: readonly number[]) {
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const MusicLevelCandidateColumn = React.memo(function MusicLevelCandidateColumn({
  level,
  hueAngle,
  candidateOverridesByLevel,
  selectedLevels,
  burstHighlight,
  hoveredCandidate,
  onCandidateOverridesByLevelChange,
  onSelectedLevelsChange,
  onHoveredCandidateChange,
  onBlockClick,
}: MusicLevelCandidateColumnProps) {
  const { t } = useTranslation();
  const swipeStartRef = useRef({ current: 0, startX: 0 });
  const cands = LEVEL_CANDIDATES[level.levelIndex];
  const hasCands = cands.length > 1;
  const isDirect = candidateOverridesByLevel.has(level.levelIndex);
  const overrideCandidateIndex = candidateOverridesByLevel.get(level.levelIndex);
  const autoCandidateIndex = hasCands ? findClosestCandidate(level.levelIndex, hueAngle) : 0;
  const currentCandidateIndex = isDirect ? overrideCandidateIndex! : autoCandidateIndex;
  const previousCandidateIndex = hasCands ? (currentCandidateIndex - 1 + cands.length) % cands.length : -1;
  const nextCandidateIndex = hasCands ? (currentCandidateIndex + 1) % cands.length : -1;
  const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;

  const selectCandidate = (candidateIndex: number, clearSelected: boolean) => {
    onCandidateOverridesByLevelChange((prev) => {
      const next = new Map(prev);
      next.set(level.levelIndex, candidateIndex);
      return next;
    });
    if (clearSelected) {
      onSelectedLevelsChange((prev) => {
        const next = new Set(prev);
        next.delete(level.levelIndex);
        return next;
      });
    }
    onHoveredCandidateChange(null);
  };

  const makeSwatch = (candidateIndex: number, size: number) => {
    const cand = cands[candidateIndex];
    const candHex = candidateHex(cand.rgb);
    const isSwatchHovered =
      hoveredCandidate !== null && hoveredCandidate.levelIndex === level.levelIndex && hoveredCandidate.candidateIndex === candidateIndex;
    const swatchClick = () => {
      selectCandidate(candidateIndex, true);
      onBlockClick(level.levelIndex, cand.angle);
    };
    return (
      <div
        key={candidateIndex}
        role="button"
        tabIndex={0}
        aria-label={t("aria_color_candidate", level.levelIndex, candHex, `${Math.round(cand.angle)}°`)}
        onClick={swatchClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            swatchClick();
          }
        }}
        onPointerEnter={isTouchDevice ? undefined : () => onHoveredCandidateChange({ levelIndex: level.levelIndex, candidateIndex })}
        onPointerLeave={isTouchDevice ? undefined : () => onHoveredCandidateChange(null)}
        title={`${candHex} ${Math.round(cand.angle)}\u00B0`}
        style={{
          width: size,
          height: size,
          borderRadius: R.md,
          cursor: "pointer",
          background: `rgb(${cand.rgb.join(",")})`,
          border: `2px solid ${C.border}`,
          boxSizing: "border-box" as const,
          boxShadow: isSwatchHovered ? SHADOW.glow(C.accent) : "none",
          transition: "background 0.4s, box-shadow 0.15s, border-color 0.15s",
        }}
      />
    );
  };

  const cycleCand = (dir: number) => {
    const cur = candidateOverridesByLevel.has(level.levelIndex) ? candidateOverridesByLevel.get(level.levelIndex)! : autoCandidateIndex;
    const newIdx = (((cur + dir) % cands.length) + cands.length) % cands.length;
    onCandidateOverridesByLevelChange((prev) => {
      const next = new Map(prev);
      next.set(level.levelIndex, newIdx);
      return next;
    });
    onHoveredCandidateChange({ levelIndex: level.levelIndex, candidateIndex: newIdx });
  };

  const handleWheel = hasCands
    ? (e: React.WheelEvent) => {
        e.preventDefault();
        cycleCand(e.deltaY > 0 ? 1 : -1);
      }
    : undefined;

  const handleTouchStart = hasCands
    ? (e: React.TouchEvent) => {
        swipeStartRef.current.current = e.touches[0].clientY;
        swipeStartRef.current.startX = e.touches[0].clientX;
      }
    : undefined;

  const handleTouchEnd = hasCands
    ? (e: React.TouchEvent) => {
        const dy = e.changedTouches[0].clientY - swipeStartRef.current.current;
        const dx = e.changedTouches[0].clientX - swipeStartRef.current.startX;
        if (Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx)) cycleCand(dy > 0 ? 1 : -1);
      }
    : undefined;

  const mainCandidateIndex = currentCandidateIndex;
  const mainCand = cands[mainCandidateIndex];
  const mainHex = mainCand ? candidateHex(mainCand.rgb) : "";
  const isMainHovered =
    hoveredCandidate !== null && hoveredCandidate.levelIndex === level.levelIndex && hoveredCandidate.candidateIndex === mainCandidateIndex;
  const isSelected = selectedLevels.has(level.levelIndex);
  const isBurst = burstHighlight.has(level.levelIndex);

  const mainClick = () => {
    if (!mainCand) return;
    onSelectedLevelsChange((prev) => {
      const next = new Set(prev);
      if (isSelected) next.delete(level.levelIndex);
      else next.add(level.levelIndex);
      return next;
    });
    onBlockClick(level.levelIndex, mainCand.angle);
  };

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
        role="button"
        tabIndex={0}
        aria-label={mainCand ? t("aria_color_candidate", level.levelIndex, mainHex, `${Math.round(mainCand.angle)}°`) : undefined}
        aria-pressed={isSelected}
        onClick={mainClick}
        onKeyDown={
          isTouchDevice
            ? undefined
            : (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  mainClick();
                }
              }
        }
        onPointerEnter={
          isTouchDevice ? undefined : () => onHoveredCandidateChange({ levelIndex: level.levelIndex, candidateIndex: mainCandidateIndex })
        }
        onPointerLeave={isTouchDevice ? undefined : () => onHoveredCandidateChange(null)}
        title={mainCand ? `${mainHex} ${Math.round(mainCand.angle)}\u00B0` : undefined}
        style={{
          width: 28,
          height: 28,
          borderRadius: R.md,
          background: isDirect ? `rgb(${cands[overrideCandidateIndex!]?.rgb.join(",")})` : level.hex,
          border: `2px solid ${isBurst ? "#ffffff" : isMainHovered || isSelected ? C.accent : C.border}`,
          boxSizing: "border-box" as const,
          cursor: "pointer",
          boxShadow: isBurst ? SHADOW.glow("#ffffff") : isMainHovered ? SHADOW.glow(C.accent) : "none",
          transition: isBurst ? "none" : "background 0.4s, box-shadow 0.5s, border-color 0.5s",
        }}
      />
      {hasCands ? makeSwatch(nextCandidateIndex, 20) : <div style={{ height: 20 }} />}
    </div>
  );
});

export const MusicLevelCandidateGrid = React.memo(function MusicLevelCandidateGrid({
  levelPreview,
  ...columnProps
}: MusicLevelCandidateGridProps) {
  return (
    <div
      className="music-candidate-grid"
      style={{ display: "flex", gap: SP.sm, justifyContent: "center", alignItems: "center", marginTop: SP.lg }}
    >
      {levelPreview.map((level) => (
        <MusicLevelCandidateColumn key={level.levelIndex} {...columnProps} level={level} />
      ))}
    </div>
  );
});
