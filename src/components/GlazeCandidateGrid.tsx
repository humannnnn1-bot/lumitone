import React, { useRef } from "react";

import { LEVEL_CANDIDATES, findClosestCandidate } from "../color-engine";
import { useTranslation } from "../i18n";
import { C, R, SHADOW, SP } from "../styles/tokens";

export interface GlazeLevelPreview {
  lv: number;
  name: string;
  rgb: [number, number, number];
  hex: string;
}

type GlazeCandidateHover = { lv: number; ci: number } | null;

interface GlazeCandidateGridProps {
  levelPreview: GlazeLevelPreview[];
  hueAngle: number;
  directCandidates: Map<number, number>;
  selectedLevels: Set<number>;
  hoveredCandidate: GlazeCandidateHover;
  onDirectCandidatesChange: React.Dispatch<React.SetStateAction<Map<number, number>>>;
  onSelectedLevelsChange: React.Dispatch<React.SetStateAction<Set<number>>>;
  onHoveredCandidateChange: React.Dispatch<React.SetStateAction<GlazeCandidateHover>>;
}

interface GlazeCandidateColumnProps extends Omit<GlazeCandidateGridProps, "levelPreview"> {
  level: GlazeLevelPreview;
}

function candidateHex(rgb: number[]) {
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const GlazeCandidateColumn = React.memo(function GlazeCandidateColumn({
  level,
  hueAngle,
  directCandidates,
  selectedLevels,
  hoveredCandidate,
  onDirectCandidatesChange,
  onSelectedLevelsChange,
  onHoveredCandidateChange,
}: GlazeCandidateColumnProps) {
  const { t } = useTranslation();
  const swipeStartRef = useRef(0);
  const cands = LEVEL_CANDIDATES[level.lv];
  const hasCands = cands.length > 1;
  const isDirect = directCandidates.has(level.lv);
  const directIdx = directCandidates.get(level.lv);
  const autoIdx = hasCands ? findClosestCandidate(level.lv, hueAngle) : 0;
  const currentIdx = isDirect ? directIdx! : autoIdx;
  const prevIdx = hasCands ? (currentIdx - 1 + cands.length) % cands.length : -1;
  const nextIdx = hasCands ? (currentIdx + 1) % cands.length : -1;

  const toggleSwatch = (ci: number) => {
    const deselecting = directCandidates.get(level.lv) === ci;
    onDirectCandidatesChange((prev) => {
      const next = new Map(prev);
      if (deselecting) next.delete(level.lv);
      else next.set(level.lv, ci);
      return next;
    });
    onSelectedLevelsChange((prev) => {
      const next = new Set(prev);
      next.delete(level.lv);
      return next;
    });
    onHoveredCandidateChange(null);
  };

  const cycleCandidate = (dir: number) => {
    const cur = directCandidates.has(level.lv) ? directCandidates.get(level.lv)! : autoIdx;
    const newIdx = (((cur + dir) % cands.length) + cands.length) % cands.length;
    onDirectCandidatesChange((prev) => {
      const next = new Map(prev);
      next.set(level.lv, newIdx);
      return next;
    });
    onHoveredCandidateChange({ lv: level.lv, ci: newIdx });
  };

  const makeSwatch = (ci: number, size: number) => {
    const cand = cands[ci];
    const hex = candidateHex(cand.rgb);
    const isSelected = directCandidates.get(level.lv) === ci;
    const isHovered = hoveredCandidate !== null && hoveredCandidate.lv === level.lv && hoveredCandidate.ci === ci;
    const angleLabel = `${Math.round(cand.angle)}\u00b0`;
    return (
      <div
        key={ci}
        role="button"
        tabIndex={0}
        aria-label={t("glaze_level_swatch_aria", level.lv, hex, angleLabel)}
        aria-pressed={isSelected}
        onClick={() => toggleSwatch(ci)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSwatch(ci);
          }
        }}
        onPointerEnter={() => onHoveredCandidateChange({ lv: level.lv, ci })}
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
    const isSelected = selectedLevels.has(level.lv);
    if (isSelected) {
      onSelectedLevelsChange((prev) => {
        const next = new Set(prev);
        next.delete(level.lv);
        return next;
      });
      onDirectCandidatesChange((prev) => {
        const next = new Map(prev);
        next.delete(level.lv);
        return next;
      });
      return;
    }

    onSelectedLevelsChange((prev) => {
      const next = new Set(prev);
      next.add(level.lv);
      return next;
    });
    if (!isDirect) {
      onDirectCandidatesChange((prev) => {
        const next = new Map(prev);
        next.set(level.lv, autoIdx);
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

  const mainCi = currentIdx;
  const mainCand = cands[mainCi];
  const mainHex = mainCand ? candidateHex(mainCand.rgb) : "";
  const mainAngleLabel = mainCand ? `${Math.round(mainCand.angle)}\u00b0` : "";
  const isMainHovered = hoveredCandidate !== null && hoveredCandidate.lv === level.lv && hoveredCandidate.ci === mainCi;
  const mainSelected = selectedLevels.has(level.lv);

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
      {hasCands ? makeSwatch(prevIdx, 20) : <div style={{ height: 20 }} />}
      <div
        role={hasCands ? "button" : undefined}
        tabIndex={hasCands ? 0 : undefined}
        aria-label={hasCands && mainCand ? t("glaze_level_swatch_aria", level.lv, mainHex, mainAngleLabel) : undefined}
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
        onPointerEnter={() => onHoveredCandidateChange({ lv: level.lv, ci: mainCi })}
        onPointerLeave={() => onHoveredCandidateChange(null)}
        title={mainSelected ? t("title_reset_auto") : mainCand ? `${mainHex} ${mainAngleLabel}` : undefined}
        style={{
          width: 28,
          height: 28,
          borderRadius: R.md,
          background: isDirect ? `rgb(${cands[directIdx!]?.rgb.join(",")})` : level.hex,
          border: `2px solid ${isMainHovered || mainSelected ? C.accent : C.border}`,
          boxSizing: "border-box" as const,
          cursor: hasCands ? "pointer" : "default",
          boxShadow: isMainHovered ? SHADOW.glow(C.accent) : "none",
          transition: "box-shadow 0.15s, border-color 0.15s",
        }}
      />
      {hasCands ? makeSwatch(nextIdx, 20) : <div style={{ height: 20 }} />}
    </div>
  );
});

export const GlazeCandidateGrid = React.memo(function GlazeCandidateGrid({ levelPreview, ...columnProps }: GlazeCandidateGridProps) {
  return (
    <div style={{ display: "flex", gap: SP.sm, justifyContent: "center", alignItems: "center" }}>
      {levelPreview.map((level) => (
        <GlazeCandidateColumn key={level.lv} {...columnProps} level={level} />
      ))}
    </div>
  );
});
