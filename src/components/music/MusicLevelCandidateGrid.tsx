import React, { useRef } from "react";
import { LEVEL_CANDIDATES, findClosestCandidate } from "../../color-engine";
import { useTranslation } from "../../i18n";
import { C, R, SHADOW, SP } from "../../styles/tokens";
import type { MusicCandidateHover, MusicLevelPreview } from "../../music/types";

interface MusicLevelCandidateGridProps {
  levelPreview: MusicLevelPreview[];
  hueAngle: number;
  directCandidates: Map<number, number>;
  selectedLevels: Set<number>;
  burstHighlight: Set<number>;
  hoveredCandidate: MusicCandidateHover;
  onDirectCandidatesChange: React.Dispatch<React.SetStateAction<Map<number, number>>>;
  onSelectedLevelsChange: React.Dispatch<React.SetStateAction<Set<number>>>;
  onHoveredCandidateChange: (candidate: MusicCandidateHover) => void;
  onBlockClick: (lv: number, angle: number) => void;
}

interface MusicLevelCandidateColumnProps extends Omit<MusicLevelCandidateGridProps, "levelPreview"> {
  level: MusicLevelPreview;
}

function candidateHex(rgb: number[]) {
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const MusicLevelCandidateColumn = React.memo(function MusicLevelCandidateColumn({
  level,
  hueAngle,
  directCandidates,
  selectedLevels,
  burstHighlight,
  hoveredCandidate,
  onDirectCandidatesChange,
  onSelectedLevelsChange,
  onHoveredCandidateChange,
  onBlockClick,
}: MusicLevelCandidateColumnProps) {
  const { t } = useTranslation();
  const swipeStartRef = useRef({ current: 0, startX: 0 });
  const cands = LEVEL_CANDIDATES[level.lv];
  const hasCands = cands.length > 1;
  const isDirect = directCandidates.has(level.lv);
  const directIdx = directCandidates.get(level.lv);
  const autoIdx = hasCands ? findClosestCandidate(level.lv, hueAngle) : 0;
  const currentIdx = isDirect ? directIdx! : autoIdx;
  const prevIdx = hasCands ? (currentIdx - 1 + cands.length) % cands.length : -1;
  const nextIdx = hasCands ? (currentIdx + 1) % cands.length : -1;
  const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;

  const selectCandidate = (ci: number, clearSelected: boolean) => {
    onDirectCandidatesChange((prev) => {
      const next = new Map(prev);
      next.set(level.lv, ci);
      return next;
    });
    if (clearSelected) {
      onSelectedLevelsChange((prev) => {
        const next = new Set(prev);
        next.delete(level.lv);
        return next;
      });
    }
    onHoveredCandidateChange(null);
  };

  const makeSwatch = (ci: number, size: number) => {
    const cand = cands[ci];
    const candHex = candidateHex(cand.rgb);
    const isSwatchHovered = hoveredCandidate !== null && hoveredCandidate.lv === level.lv && hoveredCandidate.ci === ci;
    const swatchClick = () => {
      selectCandidate(ci, true);
      onBlockClick(level.lv, cand.angle);
    };
    return (
      <div
        key={ci}
        role="button"
        tabIndex={0}
        aria-label={t("aria_color_candidate", level.lv, candHex, `${Math.round(cand.angle)}°`)}
        onClick={swatchClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            swatchClick();
          }
        }}
        onPointerEnter={isTouchDevice ? undefined : () => onHoveredCandidateChange({ lv: level.lv, ci })}
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
    const cur = directCandidates.has(level.lv) ? directCandidates.get(level.lv)! : autoIdx;
    const newIdx = (((cur + dir) % cands.length) + cands.length) % cands.length;
    onDirectCandidatesChange((prev) => {
      const next = new Map(prev);
      next.set(level.lv, newIdx);
      return next;
    });
    onHoveredCandidateChange({ lv: level.lv, ci: newIdx });
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

  const mainCi = currentIdx;
  const mainCand = cands[mainCi];
  const mainHex = mainCand ? candidateHex(mainCand.rgb) : "";
  const isMainHovered = hoveredCandidate !== null && hoveredCandidate.lv === level.lv && hoveredCandidate.ci === mainCi;
  const isSelected = selectedLevels.has(level.lv);
  const isBurst = burstHighlight.has(level.lv);

  const mainClick = () => {
    if (!mainCand) return;
    onSelectedLevelsChange((prev) => {
      const next = new Set(prev);
      if (isSelected) next.delete(level.lv);
      else next.add(level.lv);
      return next;
    });
    onBlockClick(level.lv, mainCand.angle);
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
      {hasCands ? makeSwatch(prevIdx, 20) : <div style={{ height: 20 }} />}
      <div
        role="button"
        tabIndex={0}
        aria-label={mainCand ? t("aria_color_candidate", level.lv, mainHex, `${Math.round(mainCand.angle)}°`) : undefined}
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
        onPointerEnter={isTouchDevice ? undefined : () => onHoveredCandidateChange({ lv: level.lv, ci: mainCi })}
        onPointerLeave={isTouchDevice ? undefined : () => onHoveredCandidateChange(null)}
        title={mainCand ? `${mainHex} ${Math.round(mainCand.angle)}\u00B0` : undefined}
        style={{
          width: 28,
          height: 28,
          borderRadius: R.md,
          background: isDirect ? `rgb(${cands[directIdx!]?.rgb.join(",")})` : level.hex,
          border: `2px solid ${isBurst ? "#ffffff" : isMainHovered || isSelected ? C.accent : C.border}`,
          boxSizing: "border-box" as const,
          cursor: "pointer",
          boxShadow: isBurst ? SHADOW.glow("#ffffff") : isMainHovered ? SHADOW.glow(C.accent) : "none",
          transition: isBurst ? "none" : "background 0.4s, box-shadow 0.5s, border-color 0.5s",
        }}
      />
      {hasCands ? makeSwatch(nextIdx, 20) : <div style={{ height: 20 }} />}
    </div>
  );
});

export const MusicLevelCandidateGrid = React.memo(function MusicLevelCandidateGrid({
  levelPreview,
  ...columnProps
}: MusicLevelCandidateGridProps) {
  return (
    <div style={{ display: "flex", gap: SP.sm, justifyContent: "center", alignItems: "center", marginTop: SP.lg }}>
      {levelPreview.map((level) => (
        <MusicLevelCandidateColumn key={level.lv} {...columnProps} level={level} />
      ))}
    </div>
  );
});
