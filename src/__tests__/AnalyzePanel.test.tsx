// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AnalyzePanel } from "../components/AnalyzePanel";

vi.mock("../i18n", () => ({
  useTranslation: () => ({
    t: (key: string, ...args: unknown[]) => {
      if (key === "stats_title") return "Statistics";
      if (key === "stats_composition") return "Composition";
      return `${key}(${args.join(",")})`;
    },
  }),
}));

// Mock MapCanvas since it depends on canvas/WebGL
vi.mock("../components/MapCanvas", () => ({
  MapCanvas: () => React.createElement("div", { "data-testid": "map-canvas" }),
  usePixelMaps: () => ({}),
}));

function makeProps(overrides?: Partial<Parameters<typeof AnalyzePanel>[0]>) {
  const w = 10, h = 10;
  return {
    hist: [20, 15, 10, 10, 15, 10, 10, 10],
    total: 100,
    colorLUT: [
      [0, 0, 0],
      [0, 0, 255],
      [255, 0, 0],
      [255, 0, 255],
      [0, 255, 0],
      [0, 255, 255],
      [255, 255, 0],
      [255, 255, 255],
    ] as [number, number, number][],
    cc: [0, 0, 0, 0, 0, 0, 0, 0],
    brushLevel: 0,
    setBrushLevel: vi.fn(),
    cvs: { w, h, data: new Uint8Array(w * h), colorMap: new Uint8Array(w * h) },
    displayW: 320,
    displayH: 320,
    mapMode: "luminance" as const,
    setMapMode: vi.fn(),
    ...overrides,
  };
}

describe("AnalyzePanel", () => {
  it("renders stats title", () => {
    render(<AnalyzePanel {...makeProps()} />);
    expect(screen.getByText("Statistics")).toBeTruthy();
  });

  it("shows map mode buttons", () => {
    render(<AnalyzePanel {...makeProps()} />);
    const buttons = screen.getAllByRole("button");
    // 7 map mode buttons
    expect(buttons.length).toBeGreaterThanOrEqual(7);
  });
});
