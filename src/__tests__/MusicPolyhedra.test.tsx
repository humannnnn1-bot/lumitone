// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../i18n";
import { AndTriads } from "../components/music/AndTriads";
import { OctahedronMix } from "../components/music/OctahedronMix";
import { TetraSplitView } from "../components/music/TetraSplitView";
import { K8LayerGraph } from "../components/music/K8LayerGraph";
function renderWithLanguage(node: ReactNode) {
  localStorage.setItem("chromalum_lang", "en");
  return render(<LanguageProvider>{node}</LanguageProvider>);
}

describe("Music polyhedra widgets", () => {
  it("renders the subtractive AND triads", () => {
    renderWithLanguage(<AndTriads activeStep={null} activeLevels={[]} />);

    expect(screen.getByText("a∨b=7 ⇒ a+b−7 = a∧b")).toBeTruthy();
  });

  it("shows the octahedron xor result for a non-complementary pair", () => {
    renderWithLanguage(<OctahedronMix lvA={1} lvB={2} phase="result" activeLevels={[]} />);

    expect(screen.getByText("1⊕2=3")).toBeTruthy();
  });

  it("shows the T0/T1 tetra split", () => {
    renderWithLanguage(<TetraSplitView phase="t0" activeLevels={[]} />);

    expect(screen.getByText("T0")).toBeTruthy();
    expect(screen.getByText("T1")).toBeTruthy();
    expect(screen.getByText("even")).toBeTruthy();
    expect(screen.getByText("odd")).toBeTruthy();
  });

  it("shows the selected K8 layer label", () => {
    renderWithLanguage(<K8LayerGraph layer={2} activeEdgeIndex={0} activeLevels={[]} />);

    expect(screen.getByText("d=2")).toBeTruthy();
  });
});
