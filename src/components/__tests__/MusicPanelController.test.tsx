// @vitest-environment jsdom
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../i18n";
import { MusicPanel } from "../MusicPanel";

type MusicEngineParams = Parameters<(typeof import("../../hooks/useMusicEngine"))["useMusicEngine"]>[0];

const musicEngineMock = vi.hoisted(() => {
  const engine = {
    initAudio: vi.fn(),
    stopAudio: vi.fn(),
    triggerToneBurst: vi.fn(),
    playGrayMelody: vi.fn(),
    stopGrayMelody: vi.fn(),
    startFanoRhythm: vi.fn(),
    stopFanoRhythm: vi.fn(),
    analyserNode: null,
    playXorTriple: vi.fn(),
    playParityChord: vi.fn(),
    playComplementChord: vi.fn(),
    playLineAndComplement: vi.fn(),
    playSyndromeDemo: vi.fn(),
    playGray3Voice: vi.fn(),
    playWeightSpectrum: vi.fn(),
    playCayleyRow: vi.fn(),
    applyGL32Transform: vi.fn(),
    resetGL32Transform: vi.fn(),
    setLumaMode: vi.fn(),
    stopAlgebra: vi.fn(),
    setDroneMuted: vi.fn(),
    playComplementCanon: vi.fn(),
    playZigzagMelody: vi.fn(),
    stopZigzagMelody: vi.fn(),
    playPointFanoContext: vi.fn(),
    playExtendedHamming: vi.fn(),
    playDistributiveLaw: vi.fn(),
    playAndTriads: vi.fn(),
    playOctahedronMix: vi.fn(),
    playK8Layer: vi.fn(),
  };
  return {
    engine,
    useMusicEngine: vi.fn((_params: unknown) => engine),
  };
});

vi.mock("../../hooks/useMusicEngine", () => ({
  useMusicEngine: musicEngineMock.useMusicEngine,
}));

function isResettableMock(value: unknown): value is { mockReset: () => void } {
  return typeof value === "function" && "mockReset" in value;
}

function resetMusicEngineMocks() {
  for (const value of Object.values(musicEngineMock.engine)) {
    if (isResettableMock(value)) value.mockReset();
  }
  musicEngineMock.useMusicEngine.mockReset();
  musicEngineMock.useMusicEngine.mockImplementation((_params: unknown) => musicEngineMock.engine);
}

function renderWithLanguage(node: ReactNode) {
  localStorage.setItem("chromalum_lang", "en");
  return render(<LanguageProvider>{node}</LanguageProvider>);
}

function latestEngineParams(): MusicEngineParams {
  const latest = musicEngineMock.useMusicEngine.mock.calls[musicEngineMock.useMusicEngine.mock.calls.length - 1];
  if (!latest) throw new Error("useMusicEngine was not called");
  return latest[0] as MusicEngineParams;
}

function getMainCandidateButton(level: number): HTMLElement {
  const button = screen
    .getAllByRole("button", { name: new RegExp(`Level ${level} color candidate`) })
    .find((candidate) => candidate.getAttribute("aria-pressed") !== null);
  if (!button) throw new Error(`Level ${level} main candidate button was not found`);
  return button;
}

describe("MusicPanel controller integration", () => {
  beforeEach(() => {
    resetMusicEngineMocks();
  });

  it("passes transport mode changes through to the music engine", () => {
    renderWithLanguage(<MusicPanel />);

    expect(latestEngineParams()).toMatchObject({
      scaleMode: "diatonic7",
      fmEnabled: false,
      lumaMode: "symmetric",
      volume: 0.7,
    });

    fireEvent.click(screen.getByRole("button", { name: "Just" }));
    expect(latestEngineParams().scaleMode).toBe("ji");

    fireEvent.click(screen.getByRole("button", { name: "FM" }));
    expect(latestEngineParams().fmEnabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Luma" }));
    expect(latestEngineParams().lumaMode).toBe("bt601Luma");

    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(latestEngineParams().volume).toBe(0);
    expect(screen.getByRole("button", { name: "Unmute" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "25" } });
    expect(latestEngineParams().volume).toBe(0.25);
    expect(screen.getByRole("button", { name: "Mute" })).toBeTruthy();
  });

  it("restores the pre-mute volume when unmuted", () => {
    renderWithLanguage(<MusicPanel />);

    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "25" } });
    expect(latestEngineParams().volume).toBe(0.25);

    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(latestEngineParams().volume).toBe(0);
    expect(screen.getByRole("button", { name: "Unmute" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
    expect(latestEngineParams().volume).toBe(0.25);
    expect(screen.getByRole("button", { name: "Mute" })).toBeTruthy();
  });

  it("initializes audio and resumes the drone from hue and alpha rotation controls", () => {
    renderWithLanguage(<MusicPanel />);
    musicEngineMock.engine.initAudio.mockClear();
    musicEngineMock.engine.setDroneMuted.mockClear();

    for (const name of [
      "Auto-rotate hue backward",
      "Auto-rotate hue forward",
      "Auto-rotate hue phase backward",
      "Auto-rotate hue phase forward",
    ]) {
      fireEvent.click(screen.getByRole("button", { name }));
    }

    expect(musicEngineMock.engine.initAudio).toHaveBeenCalledTimes(4);
    expect(musicEngineMock.engine.setDroneMuted).toHaveBeenCalledWith(false);
  });

  it("routes hue, alpha, and candidate interactions through the controller", () => {
    renderWithLanguage(<MusicPanel />);
    musicEngineMock.engine.initAudio.mockClear();
    musicEngineMock.engine.setDroneMuted.mockClear();
    musicEngineMock.engine.triggerToneBurst.mockClear();

    fireEvent.click(getMainCandidateButton(2));
    expect(musicEngineMock.engine.initAudio).toHaveBeenCalled();
    expect(musicEngineMock.engine.triggerToneBurst).toHaveBeenCalledWith(2, expect.any(Number));
    expect(getMainCandidateButton(2).getAttribute("aria-pressed")).toBe("true");

    fireEvent.change(screen.getByLabelText("Hue angle (0-359 degrees)"), { target: { value: "180" } });
    expect(musicEngineMock.engine.setDroneMuted).toHaveBeenCalledWith(false);
    expect((screen.getByLabelText("Hue angle (0-359 degrees)") as HTMLInputElement).value).toBe("180");
    expect(getMainCandidateButton(2).getAttribute("aria-pressed")).toBe("false");

    fireEvent.change(screen.getByLabelText("Hue phase"), { target: { value: "90" } });
    expect(latestEngineParams()).toMatchObject({ alpha0: 90, alpha7: 90 });
  });

  it("triggers tone bursts from music keyboard shortcuts", () => {
    renderWithLanguage(<MusicPanel />);
    musicEngineMock.engine.initAudio.mockClear();
    musicEngineMock.engine.triggerToneBurst.mockClear();

    fireEvent.keyDown(document, { key: "3" });

    expect(musicEngineMock.engine.initAudio).toHaveBeenCalled();
    expect(musicEngineMock.engine.triggerToneBurst).toHaveBeenCalledWith(3, expect.any(Number));
  });

  it("routes linked visualization origin and phase controls through the controller", () => {
    renderWithLanguage(<MusicPanel />);
    musicEngineMock.engine.setDroneMuted.mockClear();

    expect(latestEngineParams()).toMatchObject({ originMode: 0, alpha7: 0 });

    fireEvent.click(screen.getByRole("button", { name: "L7=origin" }));
    expect(musicEngineMock.engine.setDroneMuted).toHaveBeenCalledWith(false);
    expect(latestEngineParams().originMode).toBe(7);

    fireEvent.click(screen.getByRole("button", { name: "Anti-phase" }));
    expect(latestEngineParams().alpha7).toBe(180);
  });

  it("starts traversal playback and Stop All resets active playback state", () => {
    musicEngineMock.engine.playGrayMelody.mockImplementation((_tempo: number, onStep: (levelIndex: number | null) => void) => onStep(2));
    musicEngineMock.engine.startFanoRhythm.mockImplementation((_tempo: number, onBeat: (lines: number[], pos: number) => void) =>
      onBeat([0, 2], 1),
    );

    renderWithLanguage(<MusicPanel />);
    musicEngineMock.engine.initAudio.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "\u25b6 Gray" }));
    expect(musicEngineMock.engine.initAudio).toHaveBeenCalled();
    expect(musicEngineMock.engine.playGrayMelody).toHaveBeenCalledWith(120, expect.any(Function));
    expect(screen.getByRole("button", { name: "\u23f9 Gray" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "\u25b6 Rhythm" }));
    expect(musicEngineMock.engine.startFanoRhythm).toHaveBeenCalledWith(120, expect.any(Function));
    expect(screen.getByRole("button", { name: "\u23f9 Rhythm" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Stop All" }));

    expect(musicEngineMock.engine.stopGrayMelody).toHaveBeenCalled();
    expect(musicEngineMock.engine.stopFanoRhythm).toHaveBeenCalled();
    expect(musicEngineMock.engine.stopAlgebra).toHaveBeenCalled();
    expect(musicEngineMock.engine.stopZigzagMelody).toHaveBeenCalled();
    expect(musicEngineMock.engine.setDroneMuted).toHaveBeenCalledWith(true);
    expect(musicEngineMock.engine.stopAudio).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "\u25b6 Gray" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "\u25b6 Rhythm" })).toBeTruthy();
  });

  it("stops active traversal playback from the Fano controls", () => {
    musicEngineMock.engine.playGrayMelody.mockImplementation((_tempo: number, onStep: (levelIndex: number | null) => void) => onStep(2));
    musicEngineMock.engine.startFanoRhythm.mockImplementation((_tempo: number, onBeat: (lines: number[], pos: number) => void) =>
      onBeat([0, 2], 1),
    );

    renderWithLanguage(<MusicPanel />);

    fireEvent.click(screen.getByRole("button", { name: "\u25b6 Gray" }));
    expect(screen.getByRole("button", { name: "\u23f9 Gray" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "\u23f9 Gray" }));
    expect(musicEngineMock.engine.stopGrayMelody).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "\u25b6 Gray" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "\u25b6 Rhythm" }));
    expect(screen.getByRole("button", { name: "\u23f9 Rhythm" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "\u23f9 Rhythm" }));
    expect(musicEngineMock.engine.stopFanoRhythm).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "\u25b6 Rhythm" })).toBeTruthy();
  });

  it("resets transport settings back to defaults", () => {
    renderWithLanguage(<MusicPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Just" }));
    fireEvent.click(screen.getByRole("button", { name: "FM" }));
    fireEvent.click(screen.getByRole("button", { name: "Luma" }));
    fireEvent.change(screen.getByLabelText("Hue angle (0-359 degrees)"), { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText("Hue phase"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("BPM"), { target: { value: "160" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Fano point" }), { target: { value: "6" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Fano line" }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));

    expect(latestEngineParams()).toMatchObject({
      scaleMode: "ji",
      fmEnabled: true,
      lumaMode: "bt601Luma",
      volume: 0,
    });
    expect((screen.getByLabelText("Hue angle (0-359 degrees)") as HTMLInputElement).value).toBe("180");
    expect((screen.getByLabelText("Hue phase") as HTMLInputElement).value).toBe("90");
    expect((screen.getByLabelText("BPM") as HTMLInputElement).value).toBe("160");
    expect((screen.getByRole("combobox", { name: "Fano point" }) as HTMLSelectElement).value).toBe("6");
    expect((screen.getByRole("combobox", { name: "Fano line" }) as HTMLSelectElement).value).toBe("2");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(latestEngineParams()).toMatchObject({
      scaleMode: "diatonic7",
      fmEnabled: false,
      lumaMode: "symmetric",
      volume: 0.7,
    });
    expect(screen.getByRole("button", { name: "Mute" })).toBeTruthy();
    expect((screen.getByLabelText("Hue angle (0-359 degrees)") as HTMLInputElement).value).toBe("0");
    expect((screen.getByLabelText("Hue phase") as HTMLInputElement).value).toBe("0");
    expect((screen.getByLabelText("BPM") as HTMLInputElement).value).toBe("120");
    expect((screen.getByRole("combobox", { name: "Fano point" }) as HTMLSelectElement).value).toBe("1");
    expect((screen.getByRole("combobox", { name: "Fano line" }) as HTMLSelectElement).value).toBe("0");
    expect(musicEngineMock.engine.resetGL32Transform).toHaveBeenCalledWith(expect.any(Function));
    expect(musicEngineMock.engine.setDroneMuted).toHaveBeenCalledWith(true);
    expect(musicEngineMock.engine.setDroneMuted).toHaveBeenCalledWith(false);
  });

  it("restarts active traversal playback when the tempo changes", async () => {
    musicEngineMock.engine.playGrayMelody.mockImplementation((_tempo: number, onStep: (levelIndex: number | null) => void) => onStep(1));
    musicEngineMock.engine.startFanoRhythm.mockImplementation((_tempo: number, onBeat: (lines: number[], pos: number) => void) =>
      onBeat([1], 0),
    );

    renderWithLanguage(<MusicPanel />);

    fireEvent.click(screen.getByRole("button", { name: "\u25b6 Gray" }));
    fireEvent.click(screen.getByRole("button", { name: "\u25b6 Rhythm" }));
    musicEngineMock.engine.playGrayMelody.mockClear();
    musicEngineMock.engine.startFanoRhythm.mockClear();
    musicEngineMock.engine.stopGrayMelody.mockClear();
    musicEngineMock.engine.stopFanoRhythm.mockClear();

    fireEvent.change(screen.getByLabelText("BPM"), { target: { value: "160" } });

    await waitFor(() => expect(musicEngineMock.engine.playGrayMelody).toHaveBeenCalledWith(160, expect.any(Function)));
    expect(musicEngineMock.engine.stopGrayMelody).toHaveBeenCalled();
    expect(musicEngineMock.engine.startFanoRhythm).toHaveBeenCalledWith(160, expect.any(Function));
    expect(musicEngineMock.engine.stopFanoRhythm).toHaveBeenCalled();
  });

  it("routes XOR playback through selected operands", () => {
    let onXorStep: ((levelIndex: number | null) => void) | undefined;
    musicEngineMock.engine.playXorTriple.mockImplementation((_a: number, _b: number, onStep: (levelIndex: number | null) => void) => {
      onXorStep = onStep;
      onStep(5);
    });

    renderWithLanguage(<MusicPanel />);
    musicEngineMock.engine.initAudio.mockClear();

    fireEvent.change(screen.getByRole("combobox", { name: "XOR first color" }), { target: { value: "3" } });
    fireEvent.change(screen.getByRole("combobox", { name: "XOR second color" }), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "\u25b6 XOR" }));

    expect(musicEngineMock.engine.initAudio).toHaveBeenCalled();
    expect(musicEngineMock.engine.playXorTriple).toHaveBeenCalledWith(3, 5, expect.any(Function));
    expect((screen.getByRole("combobox", { name: "Fano line" }) as HTMLSelectElement).value).toBe("6");

    act(() => onXorStep?.(null));
    expect((screen.getByRole("combobox", { name: "Fano line" }) as HTMLSelectElement).value).toBe("0");
  });

  it("routes point context playback callback through the selected Fano line", () => {
    let onContextLine: ((idx: number | null) => void) | undefined;
    musicEngineMock.engine.playPointFanoContext.mockImplementation((_point: number, onLine: (idx: number | null) => void) => {
      onContextLine = onLine;
      onLine(4);
    });

    renderWithLanguage(<MusicPanel />);
    musicEngineMock.engine.initAudio.mockClear();

    fireEvent.change(screen.getByRole("combobox", { name: "Fano point" }), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "\u25b6 Lines" }));

    expect(musicEngineMock.engine.initAudio).toHaveBeenCalled();
    expect(musicEngineMock.engine.playPointFanoContext).toHaveBeenCalledWith(6, expect.any(Function));
    expect((screen.getByRole("combobox", { name: "Fano line" }) as HTMLSelectElement).value).toBe("4");

    act(() => onContextLine?.(null));
    expect((screen.getByRole("combobox", { name: "Fano line" }) as HTMLSelectElement).value).toBe("0");
  });

  it("routes partition playback through the selected Fano line and stops active partition playback", () => {
    musicEngineMock.engine.playLineAndComplement.mockImplementation(
      (_line: number, onPhase: (phase: "line" | "complement" | null) => void) => onPhase("line"),
    );

    renderWithLanguage(<MusicPanel />);
    musicEngineMock.engine.initAudio.mockClear();

    fireEvent.change(screen.getByRole("combobox", { name: "Fano line" }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "\u25b6 Complement" }));

    expect(musicEngineMock.engine.initAudio).toHaveBeenCalled();
    expect(musicEngineMock.engine.playLineAndComplement).toHaveBeenCalledWith(2, expect.any(Function));

    fireEvent.click(screen.getByRole("button", { name: "\u25b6 Complement" }));
    expect(musicEngineMock.engine.stopAlgebra).toHaveBeenCalled();
    expect(musicEngineMock.engine.playLineAndComplement).toHaveBeenCalledTimes(1);
  });
});
