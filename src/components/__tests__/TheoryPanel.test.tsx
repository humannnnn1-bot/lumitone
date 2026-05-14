// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../i18n";
import { TheoryPanel } from "../TheoryPanel";

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

    expect(screen.getByText("Discrete Algebraic Color Theory")).toBeTruthy();
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
      "XOR Operation",
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

  it("uses the horizontal space inside the binary table SVG", () => {
    renderWithLanguage();

    const binaryTable = screen.getByRole("img", { name: "Binary Levels" });
    expect(binaryTable.getAttribute("viewBox")).toBe("8 0 368 224");

    const textNodes = Array.from(binaryTable.querySelectorAll("text"));
    const channelHeaderXs = textNodes
      .filter((node) => ["G", "R", "B"].includes(node.textContent ?? "") && node.getAttribute("y") === "18")
      .map((node) => node.getAttribute("x"));
    expect(channelHeaderXs).toEqual(["170", "192", "214"]);
    expect(textNodes.find((node) => node.textContent === "Wt")?.getAttribute("x")).toBe("242");
    expect(textNodes.find((node) => node.textContent === "Hamming")?.getAttribute("x")).toBe("274");
    expect(textNodes.find((node) => node.textContent === "Luma")?.getAttribute("x")).toBe("332");
  });

  it("keeps Color Tetra SVG definition ids unique across T0 and T1", () => {
    renderWithLanguage();

    const tetraSection = screen.getByText("Color Tetra").closest("section");
    expect(tetraSection).toBeTruthy();

    const ids = Array.from(tetraSection!.querySelectorAll("[id]")).map((node) => node.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some((id) => id.startsWith("t0-tfg-"))).toBe(true);
    expect(ids.some((id) => id.startsWith("t1-tfg-"))).toBe(true);
  });

  it("keeps Color Tetra T0 and T1 diagrams side by side in narrow layouts", () => {
    renderWithLanguage();

    const tetraPair = screen.getByTestId("tetra-pair");
    expect(tetraPair.style.display).toBe("grid");
    expect(tetraPair.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
    expect(tetraPair.querySelectorAll("svg")).toHaveLength(2);
  });

  it("clears pinned highlights when clicking the full-width background surface", async () => {
    const { container } = renderWithLanguage();

    const venn = screen.getByRole("img", { name: "Venn Diagram" });
    await act(async () => {
      fireEvent.click(venn);
      await Promise.resolve();
    });
    await waitFor(() => expect(venn.querySelector('rect[stroke="#fff"]')).toBeTruthy());

    const resetSurface = container.querySelector(".theory-reset-surface");
    expect(resetSurface).toBeTruthy();
    await act(async () => {
      fireEvent.click(resetSurface!);
      await Promise.resolve();
    });
    await waitFor(() => expect(venn.querySelector('rect[stroke="#fff"]')).toBeFalsy());
  });

  it("shows Color Star surface ridges and returns from K8 to surface mode", () => {
    renderWithLanguage();

    const starSection = screen.getByText("Color Star").closest("section");
    expect(starSection).toBeTruthy();

    const buttons = Array.from(starSection!.querySelectorAll("button"));
    const surfaceButton = buttons.find((button) => button.textContent === "Surface");
    const k8Button = buttons.find((button) => button.textContent === "K\u2088");
    expect(surfaceButton).toBeTruthy();
    expect(k8Button).toBeTruthy();

    const compoundLineCount = starSection!.querySelectorAll("line").length;
    fireEvent.click(surfaceButton!);

    expect(starSection!.textContent).toContain("24 surface faces");
    expect(surfaceButton!.getAttribute("aria-pressed")).toBe("true");
    expect(starSection!.querySelectorAll("line").length).toBeGreaterThan(compoundLineCount);

    fireEvent.click(k8Button!);
    expect(starSection!.textContent).toContain("Q\u2083(12)");
    expect(k8Button!.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(surfaceButton!);
    expect(starSection!.textContent).toContain("24 surface faces");
    expect(surfaceButton!.getAttribute("aria-pressed")).toBe("true");
  });
});
