import { describe, expect, it } from "vitest";
import { getCanvasPanelClassName, getCanvasPanelStyle, getPanelLayoutClassName } from "../panel-layout";

describe("panel layout helpers", () => {
  it("adds a modest desktop offset hint for landscape canvases", () => {
    expect(getCanvasPanelClassName(796, 448)).toBe("panel-canvas panel-canvas--landscape");
    expect(getCanvasPanelStyle(796, 448)).toEqual({
      "--display-max": "796px",
      "--canvas-landscape-offset": "12px",
    });
  });

  it("adds extra offset only for ultra-wide landscape canvases", () => {
    expect(getCanvasPanelStyle(1200, 200)).toEqual({
      "--display-max": "1200px",
      "--canvas-landscape-offset": "48px",
    });
  });

  it("leaves square and portrait canvases on the base panel style", () => {
    expect(getCanvasPanelClassName(540, 540)).toBe("panel-canvas");
    expect(getCanvasPanelStyle(540, 540)).toEqual({ "--display-max": "540px" });
    expect(getCanvasPanelClassName(304, 540)).toBe("panel-canvas");
    expect(getCanvasPanelStyle(304, 540)).toEqual({ "--display-max": "304px" });
  });

  it("classifies portrait layouts for earlier side-by-side breakpoints", () => {
    expect(getPanelLayoutClassName(304, 540)).toBe("panel-layout panel-layout--tall-portrait");
    expect(getPanelLayoutClassName(405, 540)).toBe("panel-layout panel-layout--portrait");
    expect(getPanelLayoutClassName(540, 540)).toBe("panel-layout");
    expect(getPanelLayoutClassName(796, 448)).toBe("panel-layout");
  });
});
