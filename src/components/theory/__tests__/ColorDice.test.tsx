// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../../i18n";
import { ColorDice } from "../ColorDice";

function renderWithLanguage() {
  localStorage.setItem("chromalum_lang", "en");
  return render(
    <LanguageProvider>
      <ColorDice hlLevel={null} onHover={vi.fn()} />
    </LanguageProvider>,
  );
}

describe("ColorDice", () => {
  it("shows the restricted De Morgan note instead of a blanket identity", () => {
    const { container } = renderWithLanguage();
    const text = container.textContent ?? "";

    expect(text).toContain("XOR over GF(2)");
    expect(text).toContain("Boolean lattice");
    expect(text).toContain("For disjoint colors (a ∧ b = 0)");
    expect(text).toContain("(a ⊕ b)' = a' ∧ b'");
    expect(text).toContain("a ∨ b = 7");
  });

  it("keeps the additive and subtractive column headers on one line", () => {
    renderWithLanguage();

    expect(screen.getByText("XOR view (additive reading)").style.whiteSpace).toBe("nowrap");
    expect(screen.getByText("AND view (subtractive reading)").style.whiteSpace).toBe("nowrap");
  });
});
