import { describe, expect, it } from "vitest";
import type { CanvasData, MapMode } from "../../types";
import {
  buildRegionSizeMap,
  getAnalysisMapHoverInfo,
  type AnalysisColorLUT,
  type AnalysisPixelMaps,
  rasterizeAnalysisMap,
} from "../analysis-map-render";

const colorLUT: AnalysisColorLUT = [
  [0, 0, 0],
  [0, 0, 255],
  [255, 0, 0],
  [255, 0, 255],
  [0, 255, 0],
  [0, 255, 255],
  [255, 255, 0],
  [255, 255, 255],
];

function makeCanvasData(): CanvasData {
  return {
    w: 2,
    h: 2,
    data: new Uint8Array([0, 2, 5, 7]),
    colorMap: new Uint8Array(4),
  };
}

function makePixelMaps(w = 2, h = 2): AnalysisPixelMaps {
  const n = w * h;
  const maps: AnalysisPixelMaps = {
    noise: new Float32Array(n),
    depth: new Float32Array(n),
    gradAngle: new Float32Array(n),
    gradMag: new Float32Array(n),
    regionId: new Int32Array(n),
    isEdge: new Uint8Array(n),
    levelNorm: new Float32Array(n),
    localDiversity: new Float32Array(n),
    w,
    h,
  };
  maps.noise.set([0, 0.25, 0.5, 0.75].slice(0, n));
  maps.depth.set([0, 0.25, 0.5, 1].slice(0, n));
  maps.gradAngle.set([0, Math.PI / 2, Math.PI, -Math.PI / 2].slice(0, n));
  maps.gradMag.set([0, 0.2, 0.5, 1].slice(0, n));
  maps.regionId.set([1, 1, 2, 2].slice(0, n));
  maps.isEdge.set([0, 1, 0, 0].slice(0, n));
  maps.levelNorm.set([0, 2 / 7, 5 / 7, 1].slice(0, n));
  maps.localDiversity.set([0, 0.25, 0.5, 1].slice(0, n));
  return maps;
}

describe("analysis-map-render", () => {
  it("rasterizes every analysis map mode into the provided target buffer", () => {
    const cvs = makeCanvasData();
    const pixelMaps = makePixelMaps();

    for (const mode of ["entropy", "noise", "depth", "gradient", "region", "luminance", "colorlum"] satisfies MapMode[]) {
      const target = new Uint32Array(4);
      const status = rasterizeAnalysisMap({ mode, pixelMaps, colorLUT, cvs, target });
      expect(status).toBe("rendered");
      expect(Array.from(target).some((pixel) => pixel !== 0)).toBe(true);
    }
  });

  it("clears the target and reports stale when map dimensions do not match", () => {
    const target = new Uint32Array([1, 2, 3, 4]);
    const status = rasterizeAnalysisMap({
      mode: "noise",
      pixelMaps: makePixelMaps(1, 1),
      colorLUT,
      cvs: makeCanvasData(),
      target,
    });

    expect(status).toBe("stale");
    expect(Array.from(target)).toEqual([0, 0, 0, 0]);
  });

  it("builds hover details without depending on React or canvas APIs", () => {
    const cvs = makeCanvasData();
    const pixelMaps = makePixelMaps();
    const regionSizeById = buildRegionSizeMap(pixelMaps);

    expect(regionSizeById.get(1)).toBe(2);
    expect(
      getAnalysisMapHoverInfo({
        x: 0,
        y: 0,
        mode: "luminance",
        pixelMaps,
        colorLUT,
        cvs,
        regionSizeById,
      }),
    ).toBe("(0,0) L0 Black (Gray 0)");
    expect(
      getAnalysisMapHoverInfo({
        x: 1,
        y: 0,
        mode: "region",
        pixelMaps,
        colorLUT,
        cvs,
        regionSizeById,
      }),
    ).toBe("(1,0) Region: 2px");
  });
});
