// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../../i18n";
import { K8Explorer } from "../K8Explorer";
import type { MusicEngineReturn } from "../../../hooks/useMusicEngine";

const mockEngine = {
  initAudio: vi.fn(),
  stopAlgebra: vi.fn(),
  playK8Layer: vi.fn(),
} as unknown as MusicEngineReturn;

function renderWithLanguage(node: ReactNode) {
  localStorage.setItem("chromalum_lang", "en");
  return render(<LanguageProvider>{node}</LanguageProvider>);
}

describe("K8Explorer", () => {
  it("shows the K8 layer view", () => {
    renderWithLanguage(<K8Explorer engine={mockEngine} activeLevels={[]} stopSignal={0} resetSignal={0} />);

    expect(screen.getByText("K8 Explorer")).toBeTruthy();
  });
});
