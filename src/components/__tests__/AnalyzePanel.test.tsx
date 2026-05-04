// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MapMode } from "../../types";
import { AnalyzePanel } from "../AnalyzePanel";

const analyzeMocks = vi.hoisted(() => ({
  mapCanvasProps: [] as Array<Record<string, unknown>>,
  pixelMaps: { w: 2, h: 2 },
  usePixelMaps: vi.fn(),
}));

vi.mock("../../i18n", () => ({
  useTranslation: () => ({
    t: (key: string, ...args: unknown[]) => {
      if (key === "stats_title") return "Statistics";
      if (key === "stats_composition") return "Composition";
      return args.length ? `${key}(${args.join(",")})` : key;
    },
  }),
}));

// Mock MapCanvas since it depends on canvas/WebGL
vi.mock("../MapCanvas", () => ({
  MapCanvas: (props: Record<string, unknown>) => {
    analyzeMocks.mapCanvasProps.push(props);
    return React.createElement("div", { "data-testid": "map-canvas", "data-mode": String(props.mode) });
  },
}));

vi.mock("../../hooks/usePixelMaps", () => ({
  usePixelMaps: analyzeMocks.usePixelMaps,
}));

function makeProps(overrides?: Partial<Parameters<typeof AnalyzePanel>[0]>) {
  const w = 10,
    h = 10;
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
    active: true,
    mapMode: "luminance" as const,
    setMapMode: vi.fn(),
    ...overrides,
  };
}

describe("AnalyzePanel", () => {
  beforeEach(() => {
    analyzeMocks.mapCanvasProps = [];
    analyzeMocks.usePixelMaps.mockReset();
    analyzeMocks.usePixelMaps.mockReturnValue(analyzeMocks.pixelMaps);
  });

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

  it("routes every map mode button through setMapMode", () => {
    const setMapMode = vi.fn<(mode: MapMode) => void>();
    render(<AnalyzePanel {...makeProps({ setMapMode })} />);

    for (const mode of ["luminance", "colorlum", "region", "gradient", "depth", "noise", "entropy"] satisfies MapMode[]) {
      fireEvent.click(screen.getByRole("button", { name: `stats_map_${mode}` }));
      expect(setMapMode).toHaveBeenLastCalledWith(mode);
    }
    expect(setMapMode).toHaveBeenCalledTimes(7);
  });

  it("passes map state into usePixelMaps and MapCanvas", () => {
    const showToast = vi.fn();
    const props = makeProps({ active: false, mapMode: "noise", showToast });

    render(<AnalyzePanel {...props} />);

    expect(analyzeMocks.usePixelMaps).toHaveBeenCalledWith(props.cvs, "noise", false);
    expect(analyzeMocks.mapCanvasProps).toHaveLength(1);
    expect(analyzeMocks.mapCanvasProps[0]).toEqual(
      expect.objectContaining({
        mode: "noise",
        pixelMaps: analyzeMocks.pixelMaps,
        colorLUT: props.colorLUT,
        cvs: props.cvs,
        displayW: props.displayW,
        displayH: props.displayH,
        showToast,
      }),
    );
  });

  it("memoizes rerenders when comparable props are unchanged", () => {
    const first = makeProps({ mapMode: "luminance" });
    const { rerender } = render(<AnalyzePanel {...first} />);
    expect(analyzeMocks.usePixelMaps).toHaveBeenCalledTimes(1);

    rerender(
      <AnalyzePanel
        {...first}
        hist={[...first.hist]}
        colorLUT={first.colorLUT.map((rgb) => [...rgb] as [number, number, number])}
        setMapMode={vi.fn()}
        setBrushLevel={vi.fn()}
      />,
    );
    expect(analyzeMocks.usePixelMaps).toHaveBeenCalledTimes(1);

    rerender(<AnalyzePanel {...first} mapMode="region" />);
    expect(analyzeMocks.usePixelMaps).toHaveBeenCalledTimes(2);
  });
});
