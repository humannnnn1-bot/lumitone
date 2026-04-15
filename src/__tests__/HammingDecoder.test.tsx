// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../i18n";
import { HammingDecoder } from "../components/music/HammingDecoder";
import type { MusicEngineReturn } from "../hooks/useMusicEngine";

const mockEngine = {
  initAudio: vi.fn(),
  stopAlgebra: vi.fn(),
  playParityChord: vi.fn(),
  playSyndromeDemo: vi.fn(),
} as unknown as MusicEngineReturn;

function renderWithLanguage(node: ReactNode) {
  localStorage.setItem("chromalum_lang", "en");
  return render(<LanguageProvider>{node}</LanguageProvider>);
}

describe("HammingDecoder", () => {
  it("renders parity and error views together", () => {
    renderWithLanguage(<HammingDecoder engine={mockEngine} activeLevels={[]} stopSignal={0} />);

    expect(screen.getByText("Hamming Decoder")).toBeTruthy();
    expect(screen.getAllByText("Parity Chords").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Error Correction").length).toBeGreaterThan(0);
  });
});
