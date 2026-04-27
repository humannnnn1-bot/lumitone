import { afterEach, describe, expect, it, vi } from "vitest";
import type { FloodFillWorkerRequest, FloodFillWorkerResponse } from "../flood-fill.worker";
import type { MapMode, WorkerRequest, WorkerResponse } from "../pixel-analysis.worker";

interface WorkerSelf {
  onmessage?: (event: MessageEvent<unknown>) => void;
  postMessage: ReturnType<typeof vi.fn>;
}

async function loadWorker(modulePath: "../flood-fill.worker" | "../pixel-analysis.worker") {
  vi.resetModules();
  const fakeSelf: WorkerSelf = { postMessage: vi.fn() };
  vi.stubGlobal("self", fakeSelf);
  if (modulePath === "../flood-fill.worker") {
    await import("../flood-fill.worker");
  } else {
    await import("../pixel-analysis.worker");
  }
  expect(fakeSelf.onmessage).toBeTypeOf("function");
  return fakeSelf;
}

function dispatchToWorker<T>(fakeSelf: WorkerSelf, data: T) {
  fakeSelf.onmessage!({ data } as MessageEvent<T>);
}

describe("worker entrypoints", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("flood-fill worker handles canvas and glaze requests with transfer lists", async () => {
    const fakeSelf = await loadWorker("../flood-fill.worker");

    const canvasReq: FloodFillWorkerRequest = {
      id: 1,
      kind: "canvas",
      data: new Uint8Array([1, 1, 0, 0]),
      sx: 0,
      sy: 0,
      newVal: 3,
      w: 2,
      h: 2,
    };
    dispatchToWorker(fakeSelf, canvasReq);

    const canvasResp = fakeSelf.postMessage.mock.calls[0][0] as FloodFillWorkerResponse;
    expect(canvasResp.id).toBe(1);
    expect([...canvasResp.data]).toEqual([3, 3, 0, 0]);
    expect([...canvasResp.changed]).toEqual([0, 1]);
    expect(fakeSelf.postMessage.mock.calls[0][1]).toHaveLength(2);

    const glazeReq: FloodFillWorkerRequest = {
      id: 2,
      kind: "glaze",
      data: new Uint8Array([2, 2, 4, 4]),
      colorMap: new Uint8Array([0, 0, 0, 0]),
      sx: 0,
      sy: 0,
      newVal: 0,
      newCmVal: 5,
      w: 2,
      h: 2,
    };
    dispatchToWorker(fakeSelf, glazeReq);

    const glazeResp = fakeSelf.postMessage.mock.calls[1][0] as FloodFillWorkerResponse;
    expect(glazeResp.id).toBe(2);
    expect([...(glazeResp.colorMap ?? new Uint8Array())]).toEqual([5, 5, 0, 0]);
    expect([...glazeResp.changed]).toEqual([0, 1]);
    expect(fakeSelf.postMessage.mock.calls[1][1]).toHaveLength(3);
  });

  it("pixel-analysis worker allocates only the maps required by each mode", async () => {
    const fakeSelf = await loadWorker("../pixel-analysis.worker");
    const modes: MapMode[] = ["noise", "entropy", "depth", "gradient", "region", "luminance", "colorlum"];

    modes.forEach((mode, index) => {
      const req: WorkerRequest = {
        id: index + 1,
        mode,
        data: new Uint8Array([0, 1, 2, 7]),
        colorMap: new Uint8Array(4),
        w: 2,
        h: 2,
      };
      dispatchToWorker(fakeSelf, req);
    });

    const responses = fakeSelf.postMessage.mock.calls.map((call) => call[0] as WorkerResponse);
    expect(responses.map((resp) => resp.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(responses[0].noise).toHaveLength(4);
    expect(responses[0].levelNorm).toHaveLength(4);
    expect(responses[1].localDiversity).toHaveLength(4);
    expect(responses[2].depth).toHaveLength(4);
    expect(responses[2].isEdge).toHaveLength(4);
    expect(responses[3].gradAngle).toHaveLength(4);
    expect(responses[3].gradMag).toHaveLength(4);
    expect(responses[4].regionId).toHaveLength(4);
    expect(responses[5].levelNorm[3]).toBe(1);
    expect(responses[6].noise).toHaveLength(0);
    expect(responses[6].levelNorm).toHaveLength(0);
  });

  it("pixel-analysis worker returns empty result objects for zero-sized canvases", async () => {
    const fakeSelf = await loadWorker("../pixel-analysis.worker");
    const req: WorkerRequest = {
      id: 99,
      mode: "noise",
      data: new Uint8Array(0),
      colorMap: new Uint8Array(0),
      w: 0,
      h: 0,
    };
    dispatchToWorker(fakeSelf, req);

    const resp = fakeSelf.postMessage.mock.calls[0][0] as WorkerResponse;
    expect(resp.id).toBe(99);
    expect(resp.noise).toHaveLength(0);
    expect(fakeSelf.postMessage.mock.calls[0][1]).toBeUndefined();
  });
});
