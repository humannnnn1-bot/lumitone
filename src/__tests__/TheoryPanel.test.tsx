// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../i18n";
import { TheoryPanel } from "../components/TheoryPanel";

function renderWithLanguage() {
  localStorage.setItem("chromalum_lang", "en");
  return render(
    <LanguageProvider>
      <TheoryPanel />
    </LanguageProvider>,
  );
}

describe("TheoryPanel", () => {
  it("renders the main theory sections and controls", () => {
    renderWithLanguage();

    expect(screen.getByText("Color Theory")).toBeTruthy();
    expect(screen.getByText("FOUNDATIONS")).toBeTruthy();
    expect(screen.getByText("COLOR GEOMETRY")).toBeTruthy();
    expect(screen.getByText("ALGEBRAIC STRUCTURES")).toBeTruthy();
    expect(screen.getByText("POLYHEDRA")).toBeTruthy();
    expect(screen.getByText("SYNTHESIS")).toBeTruthy();
    expect(screen.getByText("Complements")).toBeTruthy();
    expect(screen.getAllByText("K₈").length).toBeGreaterThan(0);
  });
});
