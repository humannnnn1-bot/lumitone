// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../i18n";
import { HammingDiagram } from "../components/theory/HammingDiagram";

function renderWithLanguage() {
  localStorage.setItem("chromalum_lang", "en");
  return render(
    <LanguageProvider>
      <HammingDiagram hlLevel={null} onHover={vi.fn()} />
    </LanguageProvider>,
  );
}

describe("HammingDiagram", () => {
  it("describes the interaction as a position error and reports the syndrome", () => {
    renderWithLanguage();

    expect(screen.getByText("Click a position to inject an error")).toBeTruthy();

    fireEvent.click(screen.getByTestId("hamming-position-5"));

    expect(screen.getByText("Error at position 5 (Cyan)")).toBeTruthy();
    expect(screen.getByTestId("hamming-syndrome").textContent?.replace(/\s+/g, " ")).toMatch(/syndrome = 101/);
  });
});
