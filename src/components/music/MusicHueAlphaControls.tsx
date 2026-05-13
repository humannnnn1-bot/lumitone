import React from "react";
import { useTranslation } from "../../i18n";
import { C, FS, FONT, SP } from "../../styles/tokens";
import type { MusicHueTick } from "../../music/types";
import { S_ALPHA_TRACK, S_HUE_INPUT, S_HUE_TRACK, S_HUE_WRAP } from "./music-panel-styles";

interface MusicHueAlphaControlsProps {
  hueAngleDeg: number;
  alpha0: number;
  hueTicks: MusicHueTick[];
  onHueChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAlphaChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ALPHA_TICKS = [0, 60, 120, 180, 240, 300];

function angleToMarkerLeft(angle: number) {
  return `${((((angle % 360) + 360) % 360) / 360) * 100}%`;
}

function Marker({ left }: { left: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 1,
        left,
        transform: "translateX(-5px)",
        width: 0,
        height: 0,
        borderLeft: "5px solid transparent",
        borderRight: "5px solid transparent",
        borderTop: `6px solid ${C.textPrimary}`,
        pointerEvents: "none",
      }}
    />
  );
}

export const MusicHueAlphaControls = React.memo(function MusicHueAlphaControls({
  hueAngleDeg,
  alpha0,
  hueTicks,
  onHueChange,
  onAlphaChange,
}: MusicHueAlphaControlsProps) {
  const { t } = useTranslation();
  const roundedHue = Math.round(((hueAngleDeg % 360) + 360) % 360);
  const roundedAlpha = Math.round(((alpha0 % 360) + 360) % 360);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: SP.md }}>
      <div style={{ fontSize: FS.lg, color: C.textPrimary, textAlign: "center", fontFamily: FONT.mono }}>
        {t("glaze_hue_angle")}: {roundedHue}&deg;
      </div>
      <div style={S_HUE_WRAP}>
        <div style={S_HUE_TRACK} />
        <Marker left={angleToMarkerLeft(hueAngleDeg)} />
        {hueTicks.map((tick, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 3,
              left: `${(tick.hueAngleDeg / 359) * 100}%`,
              transform: "translateX(-0.5px)",
              width: 1,
              height: 5,
              background: C.textDimmer,
              pointerEvents: "none",
            }}
          />
        ))}
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={roundedHue}
          onChange={onHueChange}
          aria-label={t("aria_hue_slider")}
          style={S_HUE_INPUT}
        />
      </div>

      <div style={{ fontSize: FS.lg, color: C.textPrimary, textAlign: "center", fontFamily: FONT.mono }}>
        {t("music_hue_phase")}: {roundedAlpha}&deg;
      </div>
      <div style={S_HUE_WRAP}>
        <div style={S_ALPHA_TRACK} />
        <Marker left={angleToMarkerLeft(alpha0)} />
        {ALPHA_TICKS.map((deg) => (
          <div
            key={deg}
            style={{
              position: "absolute",
              top: 3,
              left: `${(deg / 360) * 100}%`,
              transform: "translateX(-0.5px)",
              width: 1,
              height: 5,
              background: C.textDimmer,
              pointerEvents: "none",
            }}
          />
        ))}
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={roundedAlpha}
          onChange={onAlphaChange}
          aria-label={t("aria_alpha_angle")}
          style={S_HUE_INPUT}
        />
      </div>
    </div>
  );
});
