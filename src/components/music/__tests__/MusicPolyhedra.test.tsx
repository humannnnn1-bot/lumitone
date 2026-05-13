// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../../i18n";
import type { MusicEngineReturn } from "../../../hooks/useMusicEngine";
import { AndTriads } from "../AndTriads";
import { OctahedronMix } from "../OctahedronMix";
import { K8LayerGraph } from "../K8LayerGraph";
import { GrayCube } from "../GrayCube";
import { ParityChordCard } from "../ParityChordCard";
import { GL32Arrows } from "../GL32Arrows";
function renderWithLanguage(node: ReactNode) {
  localStorage.setItem("chromalum_lang", "en");
  return render(<LanguageProvider>{node}</LanguageProvider>);
}

describe("Music polyhedra widgets", () => {
  it("renders the subtractive AND triads", () => {
    renderWithLanguage(<AndTriads activeStep={null} activeLevels={[]} />);

    expect(screen.getByText("a∨b=7 ⇒ a+b−7 = a∧b")).toBeTruthy();
    for (const label of ["011", "101", "001", "110", "100", "010"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("shows the octahedron xor result for a non-complementary pair", () => {
    renderWithLanguage(<OctahedronMix lvA={1} lvB={2} phase="result" activeLevels={[]} />);

    expect(screen.getByText("1⊕2=3")).toBeTruthy();
  });

  it("shows the selected K8 layer label", () => {
    renderWithLanguage(<K8LayerGraph layer={2} activeEdgeIndex={0} activeLevels={[]} />);

    expect(screen.getByText("d=2")).toBeTruthy();
  });

  it("keeps the active Gray code node modestly sized", () => {
    const { container } = renderWithLanguage(<GrayCube currentCode={1} activeLevels={[]} />);

    expect(container.querySelector('circle[fill="#0000ff"][r="5.5"]')).toBeTruthy();
  });

  it("shows parity columns as bit labels while keeping cells as level numbers", () => {
    const engine = { initAudio: vi.fn(), playParityChord: vi.fn() } as unknown as MusicEngineReturn;
    const { container } = renderWithLanguage(
      <ParityChordCard engine={engine} activeLevels={[]} stopSignal={0} errorPos={0} errorPhase={null} />,
    );

    for (const label of ["001", "010", "011", "100", "101", "110", "111"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    for (const level of ["1", "2", "3", "4", "5", "6", "7"]) {
      expect(screen.getAllByText(level).length).toBeGreaterThan(0);
    }
    expect(container.textContent).toContain("P1: bit0 = {001,011,101,111}");
  });

  it("uses dark GL(3,2) labels for bright levels", () => {
    const { container } = renderWithLanguage(<GL32Arrows perm={[0, 1, 2, 3, 4, 5, 6, 7]} activeLevels={[]} />);

    for (const level of ["4", "5", "6", "7"]) {
      const labels = [...container.querySelectorAll("text")].filter((el) => el.textContent === level);
      expect(labels).toHaveLength(2);
      labels.forEach((label) => expect(label.getAttribute("fill")).toBe("#000"));
    }

    for (const level of ["1", "2", "3"]) {
      const labels = [...container.querySelectorAll("text")].filter((el) => el.textContent === level);
      expect(labels).toHaveLength(2);
      labels.forEach((label) => expect(label.getAttribute("fill")).toBe("#fff"));
    }
  });
});
