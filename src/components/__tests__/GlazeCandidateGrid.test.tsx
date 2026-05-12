// @vitest-environment jsdom
import { ComponentProps, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LEVEL_CANDIDATES } from "../../color-engine";
import { LanguageProvider } from "../../i18n";
import { GlazeCandidateGrid, type GlazeLevelPreview } from "../GlazeCandidateGrid";

type GridProps = ComponentProps<typeof GlazeCandidateGrid>;

function renderWithLanguage(node: ReactNode) {
  localStorage.setItem("chromalum_lang", "en");
  return render(<LanguageProvider>{node}</LanguageProvider>);
}

function makeLevelPreview(levelIndex: number): GlazeLevelPreview {
  const candidate = LEVEL_CANDIDATES[levelIndex][0];
  return {
    levelIndex,
    name: `L${levelIndex}`,
    rgb: candidate.rgb,
    hex: `rgb(${candidate.rgb.join(",")})`,
  };
}

function makeProps(overrides: Partial<GridProps> = {}): GridProps {
  return {
    levelPreview: [makeLevelPreview(2)],
    hueAngle: 0,
    candidateOverridesByLevel: new Map(),
    selectedLevels: new Set(),
    hoveredCandidate: null,
    onCandidateOverridesByLevelChange: vi.fn(),
    onSelectedLevelsChange: vi.fn(),
    onHoveredCandidateChange: vi.fn(),
    ...overrides,
  };
}

describe("GlazeCandidateGrid", () => {
  it("routes candidate swatch click and keyboard selection", () => {
    const props = makeProps();
    renderWithLanguage(<GlazeCandidateGrid {...props} />);

    const swatches = screen.getAllByRole("button", { name: /Level 2/ });
    fireEvent.click(swatches[0]);
    expect(props.onCandidateOverridesByLevelChange).toHaveBeenCalledTimes(1);
    expect(props.onSelectedLevelsChange).toHaveBeenCalledTimes(1);
    expect(props.onHoveredCandidateChange).toHaveBeenCalledWith(null);

    fireEvent.keyDown(swatches[2], { key: "Enter" });
    expect(props.onCandidateOverridesByLevelChange).toHaveBeenCalledTimes(2);
    expect(props.onSelectedLevelsChange).toHaveBeenCalledTimes(2);
  });

  it("toggles the main swatch selected state", () => {
    const props = makeProps({
      candidateOverridesByLevel: new Map([[2, 0]]),
      selectedLevels: new Set([2]),
    });
    renderWithLanguage(<GlazeCandidateGrid {...props} />);

    const selected = screen.getByRole("button", { name: /Level 2/, pressed: true });
    fireEvent.click(selected);

    expect(props.onSelectedLevelsChange).toHaveBeenCalledTimes(1);
    expect(props.onCandidateOverridesByLevelChange).toHaveBeenCalledTimes(1);
  });

  it("cycles candidates with wheel input", () => {
    const props = makeProps();
    renderWithLanguage(<GlazeCandidateGrid {...props} />);

    const mainSwatch = screen.getAllByRole("button", { name: /Level 2/ })[1];
    fireEvent.wheel(mainSwatch.parentElement!, { deltaY: 1 });

    expect(props.onCandidateOverridesByLevelChange).toHaveBeenCalledTimes(1);
    expect(props.onHoveredCandidateChange).toHaveBeenCalledWith({ levelIndex: 2, candidateIndex: expect.any(Number) });
  });
});
