// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../i18n";
import { MusicPanel } from "../MusicPanel";

vi.mock("../../hooks/useMusicEngine", () => ({
  useMusicEngine: () => ({
    initAudio: vi.fn(),
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
    setLuminanceMode: vi.fn(),
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
    playTetraSplit: vi.fn(),
    playTetraT0: vi.fn(),
    playTetraT1: vi.fn(),
    playK8Layer: vi.fn(),
  }),
}));

function renderWithLanguage(node: ReactNode) {
  localStorage.setItem("chromalum_lang", "en");
  return render(<LanguageProvider>{node}</LanguageProvider>);
}

describe("MusicPanel accessibility", () => {
  it("exposes representative accessible labels for algebra selects", () => {
    renderWithLanguage(<MusicPanel />);

    expect(screen.getByRole("combobox", { name: "XOR first color" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Cayley row" })).toBeTruthy();
  });
});
