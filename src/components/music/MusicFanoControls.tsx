import React from "react";
import { useTranslation } from "../../i18n";
import { FANO_LINES } from "../../data/theory-data";
import { C, FS, SP } from "../../styles/tokens";
import { S_BTN_SM, S_BTN_SM_ACTIVE } from "../../styles/shared";
import { MiniFanoChord } from "./MiniFanoChord";
import type { ActiveMusicLevel } from "../../music/types";
import { S_LABEL, S_SELECT, S_SECTION } from "./music-panel-styles";

interface MusicFanoControlsProps {
  hoveredFanoLine: number | null;
  onHoveredFanoLineChange: (line: number | null) => void;
  onFanoNodeClick: (levelIndex: number) => void;
  onFanoLineClick: (lineIndex: number) => void;
  activeLevels: ActiveMusicLevel[];
  grayStep: number | null;
  xorStep: number | null;
  rhythmPlaying: boolean;
  rhythmFiringLines: number[];
  partitionPhase: "line" | "complement" | null;
  partitionLineIndex: number;
  xorA: number | null;
  xorB: number | null;
  onXorAChange: (value: number | null) => void;
  onXorBChange: (value: number | null) => void;
  onPlayXor: () => void;
  fanoContextPoint: number;
  onFanoContextPointChange: (value: number) => void;
  fanoContextLine: number;
  onPlayPointContext: () => void;
  selectedFanoLine: number;
  onSelectedFanoLineChange: (value: number) => void;
  onPlayPartition: () => void;
  onGrayMelody: () => void;
  onFanoRhythm: () => void;
  rhythmTempo: number;
  onRhythmTempoChange: (value: number) => void;
}

const FANO_LEVELS = [1, 2, 3, 4, 5, 6, 7];

export const MusicFanoControls = React.memo(function MusicFanoControls({
  hoveredFanoLine,
  onHoveredFanoLineChange,
  onFanoNodeClick,
  onFanoLineClick,
  activeLevels,
  grayStep,
  xorStep,
  rhythmPlaying,
  rhythmFiringLines,
  partitionPhase,
  partitionLineIndex,
  xorA,
  xorB,
  onXorAChange,
  onXorBChange,
  onPlayXor,
  fanoContextPoint,
  onFanoContextPointChange,
  fanoContextLine,
  onPlayPointContext,
  selectedFanoLine,
  onSelectedFanoLineChange,
  onPlayPartition,
  onGrayMelody,
  onFanoRhythm,
  rhythmTempo,
  onRhythmTempoChange,
}: MusicFanoControlsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div style={{ ...S_SECTION, marginTop: SP.xl, width: "100%" }} role="heading" aria-level={3}>
        {t("music_section_fano")}
      </div>
      <MiniFanoChord
        hoveredLine={hoveredFanoLine}
        onLineHover={onHoveredFanoLineChange}
        onNodeClick={onFanoNodeClick}
        onLineClick={onFanoLineClick}
        activeLevels={activeLevels}
        playingLevel={grayStep ?? xorStep}
        playingLines={rhythmPlaying ? rhythmFiringLines : null}
        partitionPhase={partitionPhase}
        partitionLineIndex={partitionLineIndex}
      />

      <div
        style={{
          display: "flex",
          gap: SP.sm,
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          width: "100%",
          marginTop: 6,
        }}
      >
        <span style={S_LABEL}>{t("music_xor_title")}</span>
        <select
          value={xorA ?? ""}
          onChange={(e) => onXorAChange(e.target.value ? Number(e.target.value) : null)}
          aria-label={t("music_xor_left_select")}
          style={S_SELECT}
        >
          <option value="">--</option>
          {FANO_LEVELS.map((levelIndex) => (
            <option key={levelIndex} value={levelIndex}>
              {levelIndex}
            </option>
          ))}
        </select>
        <select
          value={xorB ?? ""}
          onChange={(e) => onXorBChange(e.target.value ? Number(e.target.value) : null)}
          aria-label={t("music_xor_right_select")}
          style={S_SELECT}
        >
          <option value="">--</option>
          {FANO_LEVELS.map((levelIndex) => (
            <option key={levelIndex} value={levelIndex}>
              {levelIndex}
            </option>
          ))}
        </select>
        {xorA != null && xorB != null && <span style={S_LABEL}>= {xorA ^ xorB}</span>}
        <button
          type="button"
          style={xorStep !== null ? S_BTN_SM_ACTIVE : S_BTN_SM}
          onClick={onPlayXor}
          disabled={xorA == null || xorB == null}
        >
          {t("music_xor_play")}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: SP.sm,
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          width: "100%",
          marginTop: 3,
        }}
      >
        <span style={S_LABEL}>{t("music_pointfano_title")}</span>
        <select
          value={fanoContextPoint}
          onChange={(e) => onFanoContextPointChange(Number(e.target.value))}
          aria-label={t("music_fano_point_select")}
          style={S_SELECT}
        >
          {FANO_LEVELS.map((levelIndex) => (
            <option key={levelIndex} value={levelIndex}>
              {levelIndex}
            </option>
          ))}
        </select>
        <button type="button" style={fanoContextLine >= 0 ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={onPlayPointContext}>
          {t("music_pointfano_play")}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: SP.sm,
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          width: "100%",
          marginTop: 3,
        }}
      >
        <span style={S_LABEL}>{t("music_dual_title")}</span>
        <select
          value={selectedFanoLine}
          onChange={(e) => onSelectedFanoLineChange(Number(e.target.value))}
          aria-label={t("music_fano_line_select")}
          style={S_SELECT}
        >
          {FANO_LINES.map((line, i) => (
            <option key={i} value={i}>
              {line.join("-")}
            </option>
          ))}
        </select>
        <button type="button" style={partitionPhase !== null ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={onPlayPartition}>
          {t("music_dual_play")}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: SP.sm,
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          width: "100%",
          marginTop: 3,
        }}
      >
        <span style={S_LABEL}>{t("music_traversal_title")}</span>
        <button type="button" style={grayStep !== null ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={onGrayMelody}>
          {grayStep !== null ? t("music_gray_stop") : t("music_gray_melody")}
        </button>
        <button type="button" style={rhythmPlaying ? S_BTN_SM_ACTIVE : S_BTN_SM} onClick={onFanoRhythm}>
          {rhythmPlaying ? t("music_rhythm_stop") : t("music_rhythm_start")}
        </button>
        <span style={{ fontSize: FS.lg, color: C.textDim }}>{t("music_rhythm_tempo")}</span>
        <input
          type="range"
          min={60}
          max={200}
          value={rhythmTempo}
          onChange={(e) => onRhythmTempoChange(Number(e.target.value))}
          aria-label={t("music_rhythm_tempo")}
          style={{ width: 80, minWidth: 60 }}
        />
        <span style={{ fontSize: FS.lg, color: C.textDim }}>{rhythmTempo}</span>
      </div>
    </>
  );
});
