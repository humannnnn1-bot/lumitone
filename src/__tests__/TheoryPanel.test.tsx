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
    const { container } = renderWithLanguage();

    expect(screen.getByText("Color Theory")).toBeTruthy();
    expect(screen.getByText("FOUNDATIONS & NOTATION")).toBeTruthy();
    expect(screen.getByText("CUBE & CYCLES")).toBeTruthy();
    expect(screen.getByText("PROJECTIVE GEOMETRY & CODING")).toBeTruthy();
    expect(screen.getByText("POLYHEDRA")).toBeTruthy();
    expect(screen.getByText("SYNTHESIS & LIMITS")).toBeTruthy();
    expect(screen.getByText("Complements")).toBeTruthy();
    expect(screen.getAllByText("K₈").length).toBeGreaterThan(0);

    expect(Array.from(container.querySelectorAll(".theory-heading")).map((el) => el.textContent)).toEqual([
      "Venn Diagram",
      "Binary Levels",
      "XOR Mixing",
      "Color Cube",
      "Gray Code Cycle",
      "Luma Zigzag",
      "Color Die",
      "Fano Plane",
      "Hamming Code",
      "Color Diamond",
      "Color Tetra",
      "Color Star",
      "Polyhedra network",
      "Connections",
      "Scope and Limits",
    ]);

    const polyhedraDiagram = screen.getByRole("img", { name: "Polyhedra network" });
    expect(polyhedraDiagram.querySelector("desc")?.textContent).toContain("common composition");
    const polyhedraLabels = Array.from(polyhedraDiagram.querySelectorAll("text")).map((el) => el.textContent);
    for (const label of ["Cube Q\u2083", "Octahedron", "T\u2080/T\u2081", "Stella Oct."]) {
      expect(polyhedraLabels).toContain(label);
    }
    for (const label of ["F-V reversal", "parity split", "stellation", "compounding"]) {
      expect(polyhedraLabels).toContain(label);
    }
    expect(polyhedraDiagram.querySelector('line[stroke-dasharray="4,3"]')).toBeTruthy();
  });
});
