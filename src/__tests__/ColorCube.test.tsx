// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../i18n";
import { ColorCube } from "../components/theory/ColorCube";

function renderWithLanguage() {
  localStorage.setItem("chromalum_lang", "en");
  return render(
    <LanguageProvider>
      <ColorCube hlLevel={null} onHover={vi.fn()} />
    </LanguageProvider>,
  );
}

describe("ColorCube", () => {
  it("renders all four complement diagonals when the complement overlay is enabled", () => {
    const { container } = renderWithLanguage();

    expect(container.querySelectorAll('[data-testid^="cube-complement-"]')).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Complements" }));

    expect(container.querySelectorAll('[data-testid^="cube-complement-"]')).toHaveLength(4);
    expect(container.querySelector('[data-testid="cube-complement-0-7"]')).not.toBeNull();
  });
});
