// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../i18n";
import { LuminanceLab } from "../components/music/LuminanceLab";
import type { MusicEngineReturn } from "../hooks/useMusicEngine";

const mockEngine = {
  initAudio: vi.fn(),
  stopAlgebra: vi.fn(),
  stopZigzagMelody: vi.fn(),
  playComplementCanon: vi.fn(),
  playZigzagMelody: vi.fn(),
} as unknown as MusicEngineReturn;

function renderWithLanguage(node: ReactNode) {
  localStorage.setItem("chromalum_lang", "en");
  return render(<LanguageProvider>{node}</LanguageProvider>);
}

describe("LuminanceLab", () => {
  it("groups the luminance views under one wrapper", () => {
    renderWithLanguage(<LuminanceLab engine={mockEngine} stopSignal={0} />);

    expect(screen.getByText("Luminance Lab")).toBeTruthy();
    expect(screen.getByText("Die Opposites")).toBeTruthy();
    expect(screen.getByText("Luma Zigzag")).toBeTruthy();
  });
});
