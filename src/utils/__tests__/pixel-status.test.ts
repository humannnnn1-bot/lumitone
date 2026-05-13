import { describe, expect, it } from "vitest";
import { DEFAULT_CANDIDATE_INDEX_BY_LEVEL } from "../../color-engine";
import { formatColorPixelStatus, formatGlazePixelStatus, formatHexPixelStatus, formatSourcePixelStatus } from "../pixel-status";

describe("pixel status formatters", () => {
  it("formats source pixels as source luma data", () => {
    expect(formatSourcePixelStatus({ x: 4, y: 2, lv: 3 })).toEqual({
      full: "(4,2) Source L3 Magenta gray=105 bits=011",
      compact: "(4,2) Src L3 gray=105 bits=011",
    });
  });

  it("formats color pixels as global output candidates", () => {
    expect(formatColorPixelStatus({ x: 4, y: 2, lv: 3, candidateIndexByLevel: DEFAULT_CANDIDATE_INDEX_BY_LEVEL })).toEqual({
      full: "(4,2) Color L3 c3/3 #ff00ff rgb(255,0,255) hue=300° Δ0°",
      compact: "(4,2) Color L3 c3/3 #ff00ff h=300°",
    });
  });

  it("formats hex pixels as candidate-space contribution", () => {
    expect(
      formatHexPixelStatus({
        x: 4,
        y: 2,
        lv: 3,
        candidateIndexByLevel: DEFAULT_CANDIDATE_INDEX_BY_LEVEL,
        levelHistogram: [0, 0, 0, 1248, 0, 0, 0, 0],
        patternFactor: 3,
        isLocked: false,
      }),
    ).toEqual({
      full: "(4,2) Hex L3 c3/3 @300° used=1,248px factor×3 unlocked",
      compact: "(4,2) Hex L3 c3/3 used=1.2kpx f×3 open",
    });
  });

  it("formats glaze pixels as base-to-actual override state", () => {
    expect(
      formatGlazePixelStatus({
        x: 4,
        y: 2,
        lv: 3,
        candidateIndexByLevel: DEFAULT_CANDIDATE_INDEX_BY_LEVEL,
        pixelCandidateOverrideValue: 1,
        hueAngleDeg: 15,
        candidateOverridesByLevel: new Map(),
        glazeTool: "glaze_brush",
      }),
    ).toEqual({
      full: "(4,2) Glaze L3 base c3/3 #ff00ff → actual c1/3 #ff3200 override / brush→c1/3 #ff3200",
      compact: "(4,2) Glaze L3 c3/3→c1/3 ovr brush→c1/3",
    });
  });
});
