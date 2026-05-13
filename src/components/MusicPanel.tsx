import React from "react";

import { useMusicPanelController } from "../hooks/useMusicPanelController";
import { useTranslation } from "../i18n";
import { S_PANEL_SUBTITLE } from "../styles/shared";
import { SP } from "../styles/tokens";
import { MusicAlgebraPanel } from "./music/MusicAlgebraPanel";
import { MusicFanoControls } from "./music/MusicFanoControls";
import { MusicHueAlphaControls } from "./music/MusicHueAlphaControls";
import { MusicLevelCandidateGrid } from "./music/MusicLevelCandidateGrid";
import { MusicLinkedVisualization } from "./music/MusicLinkedVisualization";
import { MusicTransportControls } from "./music/MusicTransportControls";
import { Oscilloscope } from "./music/Oscilloscope";

export const MusicPanel = React.memo(function MusicPanel() {
  const { t } = useTranslation();
  const {
    engine,
    hueAngleDeg,
    candidateOverridesByLevel,
    hoveredCandidate,
    setHoveredCandidate,
    selectedLevels,
    setSelectedLevels,
    setCandidateOverridesByLevel,
    volume,
    muted,
    scaleMode,
    setScaleMode,
    fmEnabled,
    setFmEnabled,
    alphaSpeed,
    setAlphaSpeed,
    phaseSpeed,
    setPhaseSpeed,
    hueSpeed,
    setHueSpeed,
    hoveredFanoLine,
    setHoveredFanoLine,
    lumaMode,
    setLumaMode,
    alpha0,
    alpha7,
    alphaDir,
    hueDir,
    gray3Playing,
    setGray3Playing,
    weightPlaying,
    setWeightPlaying,
    weightStep,
    setWeightStep,
    hammingMode,
    setHammingMode,
    cayleyRow,
    setCayleyRow,
    andStep,
    setAndStep,
    gray3Code,
    setGray3Code,
    cayleyCol,
    setCayleyCol,
    gl32Perm,
    setGl32Perm,
    gl32Flash,
    setGl32Flash,
    distA,
    setDistA,
    distB,
    setDistB,
    distC,
    setDistC,
    distPhase,
    setDistPhase,
    octaA,
    setOctaA,
    octaB,
    setOctaB,
    octaPhase,
    setOctaPhase,
    errorPos,
    setErrorPos,
    errorPhase,
    setErrorPhase,
    grayStep,
    rhythmPlaying,
    rhythmFiringLines,
    rhythmTempo,
    setRhythmTempo,
    xorA,
    setXorA,
    xorB,
    setXorB,
    xorStep,
    fanoContextPoint,
    setFanoContextPoint,
    fanoContextLine,
    partitionPhase,
    partitionLineIndex,
    stopSignal,
    resetSignal,
    burstHighlight,
    selectedFanoLine,
    levelPreview,
    activeLevels,
    hueTicks,
    handleAlphaPlay,
    handleAlphaReverse,
    handleHuePlay,
    handleHueReverse,
    handleStopAll,
    handleResetDefaults,
    handleHueChange,
    handleAlphaBarChange,
    handleBlockClick,
    handleGrayMelody,
    handleFanoRhythm,
    handlePlayXor,
    handlePlayPointContext,
    handlePlayPartition,
    handleFanoNodeClick,
    handleFanoLineClick,
    handleLinkedHueAngleChange,
    handleAlpha0Change,
    handleAlpha7Change,
    handleOriginModeChange,
    handleMuteToggle,
    handleVolumeChange,
    handleBgTap,
  } = useMusicPanelController();

  return (
    <div onClick={handleBgTap} style={{ display: "flex", flexDirection: "column", gap: SP.md, padding: `0 ${SP.md}px ${SP.md}px` }}>
      <div style={S_PANEL_SUBTITLE}>{t("music_title")}</div>
      <div className="panel-layout music-layout">
        <div className="panel-canvas" style={{ "--display-max": "420px" } as React.CSSProperties}>
          <MusicHueAlphaControls
            hueAngleDeg={hueAngleDeg}
            alpha0={alpha0}
            hueTicks={hueTicks}
            onHueChange={handleHueChange}
            onAlphaChange={handleAlphaBarChange}
          />

          <MusicLevelCandidateGrid
            levelPreview={levelPreview}
            hueAngleDeg={hueAngleDeg}
            candidateOverridesByLevel={candidateOverridesByLevel}
            selectedLevels={selectedLevels}
            burstHighlight={burstHighlight}
            hoveredCandidate={hoveredCandidate}
            onCandidateOverridesByLevelChange={setCandidateOverridesByLevel}
            onSelectedLevelsChange={setSelectedLevels}
            onHoveredCandidateChange={setHoveredCandidate}
            onBlockClick={handleBlockClick}
          />

          <MusicLinkedVisualization
            hueAngleDeg={hueAngleDeg}
            brushLevel={0}
            onHueAngleDegChange={handleLinkedHueAngleChange}
            hoveredCandidate={hoveredCandidate}
            onHoverCandidate={setHoveredCandidate}
            candidateOverridesByLevel={candidateOverridesByLevel}
            scaleMode={scaleMode}
            alpha0={alpha0}
            onAlpha0Change={handleAlpha0Change}
            alpha7={alpha7}
            onAlpha7Change={handleAlpha7Change}
            onOriginModeChange={handleOriginModeChange}
          />
        </div>

        <div className="panel-sidebar">
          <MusicTransportControls
            scaleMode={scaleMode}
            onScaleModeChange={setScaleMode}
            onStopAll={handleStopAll}
            onResetDefaults={handleResetDefaults}
            lumaMode={lumaMode}
            onLumaModeChange={setLumaMode}
            fmEnabled={fmEnabled}
            onFmEnabledChange={setFmEnabled}
            hueDir={hueDir}
            onHueReverse={handleHueReverse}
            onHuePlay={handleHuePlay}
            hueSpeed={hueSpeed}
            onHueSpeedChange={setHueSpeed}
            alphaDir={alphaDir}
            onAlphaReverse={handleAlphaReverse}
            onAlphaPlay={handleAlphaPlay}
            alphaSpeed={alphaSpeed}
            onAlphaSpeedChange={setAlphaSpeed}
            phaseSpeed={phaseSpeed}
            onPhaseSpeedChange={setPhaseSpeed}
            muted={muted}
            volume={volume}
            onMuteToggle={handleMuteToggle}
            onVolumeChange={handleVolumeChange}
          />

          <Oscilloscope analyserNode={engine.analyserNode} />

          <MusicFanoControls
            hoveredFanoLine={hoveredFanoLine}
            onHoveredFanoLineChange={setHoveredFanoLine}
            onFanoNodeClick={handleFanoNodeClick}
            onFanoLineClick={handleFanoLineClick}
            activeLevels={activeLevels}
            grayStep={grayStep}
            xorStep={xorStep}
            rhythmPlaying={rhythmPlaying}
            rhythmFiringLines={rhythmFiringLines}
            partitionPhase={partitionPhase}
            partitionLineIndex={partitionLineIndex}
            xorA={xorA}
            xorB={xorB}
            onXorAChange={setXorA}
            onXorBChange={setXorB}
            onPlayXor={handlePlayXor}
            fanoContextPoint={fanoContextPoint}
            onFanoContextPointChange={setFanoContextPoint}
            fanoContextLine={fanoContextLine}
            onPlayPointContext={handlePlayPointContext}
            selectedFanoLine={selectedFanoLine}
            onSelectedFanoLineChange={setHoveredFanoLine}
            onPlayPartition={handlePlayPartition}
            onGrayMelody={handleGrayMelody}
            onFanoRhythm={handleFanoRhythm}
            rhythmTempo={rhythmTempo}
            onRhythmTempoChange={setRhythmTempo}
          />
        </div>
      </div>

      <MusicAlgebraPanel
        engine={engine}
        activeLevels={activeLevels}
        stopSignal={stopSignal}
        resetSignal={resetSignal}
        cayley={{
          row: cayleyRow,
          onRowChange: setCayleyRow,
          col: cayleyCol,
          onColChange: setCayleyCol,
        }}
        distributive={{
          a: distA,
          onAChange: setDistA,
          b: distB,
          onBChange: setDistB,
          c: distC,
          onCChange: setDistC,
          phase: distPhase,
          onPhaseChange: setDistPhase,
        }}
        andTriads={{
          step: andStep,
          onStepChange: setAndStep,
        }}
        errorCorrection={{
          pos: errorPos,
          phase: errorPhase,
          onPosChange: setErrorPos,
          onPhaseChange: setErrorPhase,
        }}
        hamming={{
          mode: hammingMode,
          onModeChange: setHammingMode,
          weightPlaying,
          onWeightPlayingChange: setWeightPlaying,
          weightStep,
          onWeightStepChange: setWeightStep,
          onHoveredFanoLineChange: setHoveredFanoLine,
        }}
        octahedron={{
          a: octaA,
          onAChange: setOctaA,
          b: octaB,
          onBChange: setOctaB,
          phase: octaPhase,
          onPhaseChange: setOctaPhase,
        }}
        gray3={{
          playing: gray3Playing,
          onPlayingChange: setGray3Playing,
          code: gray3Code,
          onCodeChange: setGray3Code,
        }}
        gl32={{
          perm: gl32Perm,
          onPermChange: setGl32Perm,
          flash: gl32Flash,
          onFlashChange: setGl32Flash,
        }}
      />
    </div>
  );
});
