import { describe, expect, it } from "vitest";
import { DEFAULT_CANDIDATE_INDEX_BY_LEVEL } from "../../color-engine";
import type { CanvasData, MapMode } from "../../types";
import type { AnalysisPixelMaps } from "../../types";
import { buildRegionSizeMap, getAnalysisMapHoverInfo, type AnalysisColorLUT, rasterizeAnalysisMap } from "../analysis-map-render";

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
    width: 2,
    height: 2,
    levelData: new Uint8Array([0, 2, 5, 7]),
    pixelCandidateOverrideMap: new Uint8Array(4),
  };
}

function makePixelMaps(w = 2, h = 2): AnalysisPixelMaps {
  const n = w * h;
  const maps: AnalysisPixelMaps = {
    neighborIsolation: new Float32Array(n),
    boundaryDistance: new Float32Array(n),
    gradientAngle: new Float32Array(n),
    gradientMagnitude: new Float32Array(n),
    regionId: new Int32Array(n),
    isEdge: new Uint8Array(n),
    levelTone: new Float32Array(n),
    localDiversity: new Float32Array(n),
    width: w,
    height: h,
  };
  maps.neighborIsolation.set([0, 0.25, 0.5, 0.75].slice(0, n));
  maps.boundaryDistance.set([0, 0.25, 0.5, 1].slice(0, n));
  maps.gradientAngle.set([0, Math.PI / 2, Math.PI, -Math.PI / 2].slice(0, n));
  maps.gradientMagnitude.set([0, 0.2, 0.5, 1].slice(0, n));
  maps.regionId.set([1, 1, 2, 2].slice(0, n));
  maps.isEdge.set([0, 1, 0, 0].slice(0, n));
  maps.levelTone.set([0, 2 / 7, 5 / 7, 1].slice(0, n));
  maps.localDiversity.set([0, 0.25, 0.5, 1].slice(0, n));
  return maps;
}

describe("analysis-map-render", () => {
  it("rasterizes every analysis map mode into the provided target buffer", () => {
    const canvasData = makeCanvasData();
    const pixelMaps = makePixelMaps();

    for (const mode of ["diversity", "isolation", "boundaryDistance", "gradient", "region", "luminance", "colorLuma"] satisfies MapMode[]) {
      const target = new Uint32Array(4);
      const status = rasterizeAnalysisMap({ mode, pixelMaps, colorLUT, canvasData, target });
      expect(status).toBe("rendered");
      expect(Array.from(target).some((pixel) => pixel !== 0)).toBe(true);
    }
  });

  it("clears the target and reports stale when map dimensions do not match", () => {
    const target = new Uint32Array([1, 2, 3, 4]);
    const status = rasterizeAnalysisMap({
      mode: "isolation",
      pixelMaps: makePixelMaps(1, 1),
      colorLUT,
      canvasData: makeCanvasData(),
      target,
    });

    expect(status).toBe("stale");
    expect(Array.from(target)).toEqual([0, 0, 0, 0]);
  });

  it("reuses a supplied region size map for region rasterization", () => {
    const canvasData = makeCanvasData();
    const pixelMaps = makePixelMaps();
    const defaultTarget = new Uint32Array(4);
    const sharedTarget = new Uint32Array(4);

    rasterizeAnalysisMap({ mode: "region", pixelMaps, colorLUT, canvasData, target: defaultTarget });
    const status = rasterizeAnalysisMap({
      mode: "region",
      pixelMaps,
      colorLUT,
      canvasData,
      target: sharedTarget,
      regionSizeById: new Map([
        [1, 10],
        [2, 10],
      ]),
    });

    expect(status).toBe("rendered");
    expect(sharedTarget[0]).not.toBe(defaultTarget[0]);
  });

  it("builds hover details without depending on React or canvas APIs", () => {
    const canvasData = makeCanvasData();
    const pixelMaps = makePixelMaps();
    const regionSizeById = buildRegionSizeMap(pixelMaps);

    expect(regionSizeById.get(1)).toBe(2);
    const cases: Array<[MapMode, string]> = [
      ["luminance", "(0,0) MapTone L0 Black gray=0 level=0/7 t=0%"],
      ["colorLuma", "(0,0) MapColorLuma L0 c1/1 #000000 Y=0/255 0% dGray=0"],
      ["region", "(0,0) MapRegion L0 base c1/1 #000000 region#1 size=2px interior small"],
      ["gradient", "(0,0) MapToneGrad L0 g=(+2,+5) dir=180° mag=0% flat"],
      ["boundaryDistance", "(0,0) MapBoundaryDist L0 base c1/1 #000000 distance=0% near"],
      ["isolation", "(0,0) MapIsolation L0 base c1/1 #000000 unlike=0/4 same=4/4 score=0%"],
      ["diversity", "(0,0) MapDiversity L0 base c1/1 #000000 win=2x2 keys=4 score=0%"],
    ];

    for (const [mode, expected] of cases) {
      const status = getAnalysisMapHoverInfo({
        x: 0,
        y: 0,
        mode,
        pixelMaps,
        colorLUT,
        candidateIndexByLevel: DEFAULT_CANDIDATE_INDEX_BY_LEVEL,
        canvasData,
        regionSizeById,
      });
      expect(status?.full).toBe(expected);
      expect(status?.compact).not.toBe(expected);
      expect(status?.full).not.toMatch(/[\u3040-\u30ff\u3400-\u9fff]/);
      expect(status?.compact).not.toMatch(/[\u3040-\u30ff\u3400-\u9fff]/);
    }
  });
});
