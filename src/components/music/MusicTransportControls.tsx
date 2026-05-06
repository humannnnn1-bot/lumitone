import React from "react";
import { useTranslation } from "../../i18n";
import { C, FS, SP } from "../../styles/tokens";
import { S_BTN_SM, S_BTN_SM_ACTIVE } from "../../styles/shared";
import type { ScaleMode } from "../../hooks/useMusicEngine";
import { S_LABEL, S_MUSIC_MODE_BTN, S_MUSIC_MODE_BTN_ACTIVE } from "./music-panel-styles";

interface MusicTransportControlsProps {
  scaleMode: ScaleMode;
  onScaleModeChange: (mode: ScaleMode) => void;
  onStopAll: () => void;
  onResetDefaults: () => void;
  luminanceMode: "symmetric" | "luminance";
  onLuminanceModeChange: (mode: "symmetric" | "luminance") => void;
  fmEnabled: boolean;
  onFmEnabledChange: (enabled: boolean) => void;
  hueDir: 1 | -1 | 0;
  onHueReverse: () => void;
  onHuePlay: () => void;
  hueSpeed: number;
  onHueSpeedChange: (speed: number) => void;
  alphaDir: 1 | -1 | 0;
  onAlphaReverse: () => void;
  onAlphaPlay: () => void;
  alphaSpeed: number;
  onAlphaSpeedChange: (speed: number) => void;
  phaseSpeed: number;
  onPhaseSpeedChange: (speed: number) => void;
  muted: boolean;
  volume: number;
  onMuteToggle: () => void;
  onVolumeChange: (volume: number) => void;
}

const SCALE_MODES: ScaleMode[] = ["ji", "diatonic7", "octatonic", "12tet"];

const S_TRANSPORT_BTN: React.CSSProperties = {
  ...S_BTN_SM,
  boxSizing: "border-box",
  fontSize: FS.lg,
  height: 22,
  lineHeight: 1,
  minWidth: 36,
};

const S_TRANSPORT_BTN_ACTIVE: React.CSSProperties = {
  ...S_BTN_SM_ACTIVE,
  boxSizing: "border-box",
  fontSize: FS.lg,
  height: 22,
  lineHeight: 1,
  minWidth: 36,
};

export const MusicTransportControls = React.memo(function MusicTransportControls({
  scaleMode,
  onScaleModeChange,
  onStopAll,
  onResetDefaults,
  luminanceMode,
  onLuminanceModeChange,
  fmEnabled,
  onFmEnabledChange,
  hueDir,
  onHueReverse,
  onHuePlay,
  hueSpeed,
  onHueSpeedChange,
  alphaDir,
  onAlphaReverse,
  onAlphaPlay,
  alphaSpeed,
  onAlphaSpeedChange,
  phaseSpeed,
  onPhaseSpeedChange,
  muted,
  volume,
  onMuteToggle,
  onVolumeChange,
}: MusicTransportControlsProps) {
  const { t } = useTranslation();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.md, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: SP.md, width: "100%", flexWrap: "wrap" }}>
        {SCALE_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={scaleMode === mode}
            style={scaleMode === mode ? S_MUSIC_MODE_BTN_ACTIVE : S_MUSIC_MODE_BTN}
            onClick={() => onScaleModeChange(mode)}
          >
            {t(`music_scale_${mode}`)}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: SP.md, width: "100%", flexWrap: "wrap" }}>
        <button type="button" style={{ ...S_MUSIC_MODE_BTN, borderColor: C.error, color: C.error }} onClick={onStopAll}>
          {t("music_stop_all")}
        </button>
        <button type="button" style={S_MUSIC_MODE_BTN} onClick={onResetDefaults}>
          {t("music_reset")}
        </button>
        <span style={{ width: SP.sm }} />
        <button
          type="button"
          style={luminanceMode === "symmetric" ? S_MUSIC_MODE_BTN_ACTIVE : S_MUSIC_MODE_BTN}
          onClick={() => onLuminanceModeChange("symmetric")}
        >
          {t("music_luminance_sym")}
        </button>
        <button
          type="button"
          style={luminanceMode === "luminance" ? S_MUSIC_MODE_BTN_ACTIVE : S_MUSIC_MODE_BTN}
          onClick={() => onLuminanceModeChange("luminance")}
        >
          {t("music_luminance_bt601")}
        </button>
        <span style={{ width: SP.sm }} />
        <button type="button" style={fmEnabled ? S_MUSIC_MODE_BTN_ACTIVE : S_MUSIC_MODE_BTN} onClick={() => onFmEnabledChange(!fmEnabled)}>
          {t("music_fm_on")}
        </button>
      </div>

      <div style={{ display: "flex", gap: SP.sm, alignItems: "center" }}>
        <button
          type="button"
          style={hueDir === -1 ? S_TRANSPORT_BTN_ACTIVE : S_TRANSPORT_BTN}
          onClick={onHueReverse}
          aria-label={t("linkedviz_hue_reverse")}
          title={t("linkedviz_hue_reverse")}
        >
          {"H\u25C0"}
        </button>
        <button
          type="button"
          style={hueDir === 1 ? S_TRANSPORT_BTN_ACTIVE : S_TRANSPORT_BTN}
          onClick={onHuePlay}
          aria-label={t("linkedviz_hue_play")}
          title={t("linkedviz_hue_play")}
        >
          {"H\u25B6"}
        </button>
        <input
          type="range"
          min={10}
          max={120}
          value={hueSpeed}
          onChange={(e) => onHueSpeedChange(Number(e.target.value))}
          aria-label={t("aria_hue_speed")}
          style={{ flex: 1, minWidth: 60 }}
        />
        <span style={{ fontSize: FS.lg, color: C.textDim, fontVariantNumeric: "tabular-nums", width: 42 }}>{hueSpeed}&deg;/s</span>
      </div>

      <div style={{ display: "flex", gap: SP.sm, alignItems: "center" }}>
        <button
          type="button"
          style={alphaDir === -1 ? S_TRANSPORT_BTN_ACTIVE : S_TRANSPORT_BTN}
          onClick={onAlphaReverse}
          aria-label={t("linkedviz_alpha_reverse")}
          title={t("linkedviz_alpha_reverse")}
        >
          {"\u03b1\u25C0"}
        </button>
        <button
          type="button"
          style={alphaDir === 1 ? S_TRANSPORT_BTN_ACTIVE : S_TRANSPORT_BTN}
          onClick={onAlphaPlay}
          aria-label={t("linkedviz_alpha_play")}
          title={t("linkedviz_alpha_play")}
        >
          {"\u03b1\u25B6"}
        </button>
        <input
          type="range"
          min={10}
          max={120}
          value={alphaSpeed}
          onChange={(e) => onAlphaSpeedChange(Number(e.target.value))}
          aria-label={t("aria_alpha_speed")}
          style={{ flex: 1, minWidth: 60 }}
        />
        <span style={{ fontSize: FS.lg, color: C.textDim, fontVariantNumeric: "tabular-nums", width: 42 }}>{alphaSpeed}&deg;/s</span>
      </div>

      <div style={{ display: "flex", gap: SP.sm, alignItems: "center" }}>
        <span style={{ ...S_LABEL, minWidth: 36 + SP.sm + 36, textAlign: "center" }}>{t("music_phase_drift")}</span>
        <input
          type="range"
          min={0}
          max={72}
          value={phaseSpeed}
          onChange={(e) => onPhaseSpeedChange(Number(e.target.value))}
          aria-label={t("music_phase_drift")}
          style={{ flex: 1, minWidth: 60 }}
        />
        <span style={{ fontSize: FS.lg, color: C.textDim, fontVariantNumeric: "tabular-nums", width: 42 }}>{phaseSpeed}&deg;/s</span>
      </div>

      <div style={{ display: "flex", gap: SP.sm, alignItems: "center", justifyContent: "center" }}>
        <button
          type="button"
          onClick={onMuteToggle}
          style={muted ? S_TRANSPORT_BTN_ACTIVE : S_TRANSPORT_BTN}
          aria-label={muted ? t("music_unmute") : t("music_mute")}
          title={muted ? t("music_unmute") : t("music_mute")}
        >
          {muted ? "\uD83D\uDD07" : "\uD83D\uDD0A"}
        </button>
        <span style={S_LABEL}>{t("music_volume")}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={muted ? 0 : Math.round(volume * 100)}
          onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
          aria-label={t("music_volume")}
          style={{ flex: 1, minWidth: 60 }}
        />
      </div>
    </div>
  );
});
