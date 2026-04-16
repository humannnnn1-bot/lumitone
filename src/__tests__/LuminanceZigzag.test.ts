import { describe, expect, it } from "vitest";
import { findLumaIntersections } from "../components/theory/LuminanceZigzag";

describe("LuminanceZigzag", () => {
  it("deduplicates the red candidate at the 0/360 degree seam", () => {
    const redVertexLuma = 76.245;
    const hits = findLumaIntersections(redVertexLuma);

    expect(hits).toHaveLength(3);
    expect(hits.every((hit) => hit.h >= 0 && hit.h < 360)).toBe(true);
    expect(hits.filter((hit) => hit.h < 0.5 || hit.h > 359.5)).toHaveLength(1);
  });
});
