// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { LanguageProvider } from "../i18n";
import { VennDiagram } from "../components/theory/VennDiagram";

function renderWithLanguage(onHover = vi.fn(), hlLevel: number | null = null) {
  localStorage.setItem("chromalum_lang", "en");
  const result = render(
    <LanguageProvider>
      <VennDiagram hlLevel={hlLevel} onHover={onHover} />
    </LanguageProvider>,
  );
  return { ...result, onHover };
}

describe("VennDiagram", () => {
  it("renders 8 region labels matching P({G,R,B})", () => {
    const { container } = renderWithLanguage();
    for (let lv = 0; lv <= 7; lv++) {
      expect(container.querySelector(`[data-testid="venn-region-${lv}"]`)).toBeTruthy();
    }
  });

  it("dims non-active regions when a level is highlighted", () => {
    const { container } = renderWithLanguage(vi.fn(), 6);
    const r6 = container.querySelector('[data-testid="venn-region-6"]');
    const r1 = container.querySelector('[data-testid="venn-region-1"]');
    expect(r6?.getAttribute("opacity")).toBe("1");
    expect(Number(r1?.getAttribute("opacity"))).toBeLessThan(1);
  });

  it("shows a dashed outer border when the empty-set region is active", () => {
    const { container } = renderWithLanguage(vi.fn(), 0);
    expect(container.querySelector("svg rect[stroke-dasharray]")).toBeTruthy();
  });

  it("calls onHover with the correct level when the mouse moves over a region", () => {
    const { container, onHover } = renderWithLanguage();
    const svg = container.querySelector('svg[role="img"]') as SVGSVGElement;
    // Stub getBoundingClientRect so coordinate math is deterministic.
    svg.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 300,
      height: 260,
      right: 300,
      bottom: 260,
      toJSON: () => ({}),
    });
    // viewBox (150, 150) is inside all 3 circles → level 7 (White)
    fireEvent.mouseMove(svg, { clientX: 150, clientY: 150 });
    expect(onHover).toHaveBeenCalledWith(7);
    // viewBox (40, 32) is outside all circles → level 0 (Black)
    fireEvent.mouseMove(svg, { clientX: 40, clientY: 32 });
    expect(onHover).toHaveBeenCalledWith(0);
  });
});
