// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MAX_UNDO } from "../../constants";
import type { AnalysisPixelMaps, AppState, CanvasData, CompressedDiff, MapMode, PanZoomHandlers } from "../../types";
import { RingBuffer } from "../../utils/ring-buffer";
import { GlazeContextProvider, type GlazeContextValue } from "../../state/GlazeContext";
import type { GlazeDrawingResult } from "../../hooks/useGlazeDrawing";
import { DEFAULT_CANDIDATE_INDEX_BY_LEVEL } from "../../color-engine";
import { SourcePanel } from "../SourcePanel";
import { ColorPanel } from "../ColorPanel";
import { GlazePanel } from "../GlazePanel";
import { CropModal } from "../CropModal";
import { MapCanvas } from "../MapCanvas";

vi.mock("../../i18n", () => ({
  useTranslation: () => ({
    t: (key: string, ...args: unknown[]) => (args.length ? `${key}(${args.join(",")})` : key),
  }),
}));

vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => {},
}));

type PixelMaps = React.ComponentProps<typeof MapCanvas>["pixelMaps"];

const colorLUT: [number, number, number][] = [
  [0, 0, 0],
  [0, 0, 255],
  [255, 0, 0],
  [255, 0, 255],
  [0, 255, 0],
  [0, 255, 255],
  [255, 255, 0],
  [255, 255, 255],
];

function mockPointerFine(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query.includes("pointer: fine") ? matches : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

function makeCanvasData(w = 4, h = 4): CanvasData {
  const data = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) data[i] = i % 8;
  return { width: w, height: h, levelData: data, pixelCandidateOverrideMap: new Uint8Array(w * h) };
}

function makeState(withUndo = false): AppState {
  const undoStack = new RingBuffer<CompressedDiff>(MAX_UNDO);
  if (withUndo) {
    undoStack.push({ indexRuns: new Uint32Array([0, 1]), oldLevelValues: new Uint8Array([0]), newLevelValues: new Uint8Array([1]) });
  }
  return {
    canvasData: makeCanvasData(),
    undoStack,
    redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
    levelHistogram: [2, 2, 2, 2, 2, 2, 2, 2],
  };
}

function makePanZoom(overrides?: Partial<PanZoomHandlers>): PanZoomHandlers {
  return {
    setZoom: vi.fn(),
    setPan: vi.fn(),
    scheduleCursorRedrawRef: { current: vi.fn() },
    spaceRef: { current: false },
    panningRef: { current: false },
    startPan: vi.fn(),
    handleMiddleDown: vi.fn(),
    movePan: vi.fn(),
    endPan: vi.fn(),
    ...overrides,
  };
}

function makeGlazeDrawing(overrides?: Partial<GlazeDrawingResult>): GlazeDrawingResult {
  return {
    sourceCanvasRef: { current: null },
    cursorCanvasRef: { current: null },
    statusRef: { current: null },
    imgCacheRef: { current: { sourceImageData: null, previewImageData: null, sourcePixels32: null, previewPixels32: null } },
    drawingRef: { current: false },
    cursorRafRef: { current: null },
    scheduleCursorRedrawRef: { current: null },
    cursorPosRef: { current: null },
    onDown: vi.fn(),
    onMove: vi.fn(),
    onUp: vi.fn(),
    onWorkspaceDown: vi.fn(),
    onWorkspaceMove: vi.fn(),
    onWorkspaceLeave: vi.fn(),
    pickHue: vi.fn(),
    trackCursor: vi.fn(),
    clearCursor: vi.fn(),
    ...overrides,
  };
}

function makePixelMaps(w = 2, h = 2): PixelMaps {
  return {
    width: w,
    height: h,
    neighborIsolation: new Float32Array([0, 0.25, 0.5, 1]),
    boundaryDistance: new Float32Array([0, 0.2, 0.8, 1]),
    gradientAngle: new Float32Array([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
    gradientMagnitude: new Float32Array([0, 0.2, 0.5, 1]),
    regionId: new Int32Array([1, 1, 2, 3]),
    edgeMask: new Uint8Array([0, 1, 0, 0]),
    levelTone: new Float32Array([0, 0.25, 0.5, 1]),
    localDiversity: new Float32Array([0, 0.25, 0.75, 1]),
  } satisfies AnalysisPixelMaps;
}

describe("SourcePanel interactions", () => {
  beforeEach(() => {
    mockPointerFine(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderSource(overrides?: Partial<React.ComponentProps<typeof SourcePanel>>) {
    const sourceCanvasRef = React.createRef<HTMLCanvasElement>();
    const previewCanvasRef = React.createRef<HTMLCanvasElement>();
    const setBrushSize = vi.fn();
    const setPan = vi.fn();
    const setZoom = vi.fn();
    const saveColor = vi.fn();
    const saveGlaze = vi.fn();
    const shareColor = vi.fn();
    const shareGlaze = vi.fn();
    const props: React.ComponentProps<typeof SourcePanel> = {
      sourceCanvasRef,
      cursorCanvasRef: React.createRef<HTMLCanvasElement>(),
      sourceCanvasWrapRef: React.createRef<HTMLDivElement>(),
      statusRef: React.createRef<HTMLDivElement>(),
      toolState: {
        tool: "brush",
        setTool: vi.fn(),
        brushLevel: 2,
        setBrushLevel: vi.fn(),
        brushSize: 4,
        setBrushSize,
      },
      viewState: {
        zoom: 1,
        setZoom,
        setPan,
        displayWidth: 64,
        displayHeight: 64,
        canvasTransform: {},
        canvasCursor: "crosshair",
      },
      saveActions: {
        saveColor,
        saveColorWithLUT: vi.fn(),
        saveGlaze,
        shareColor,
        shareGlaze,
      },
      colorLUT,
      state: makeState(true),
      onDown: vi.fn(),
      onMove: vi.fn(),
      onUp: vi.fn(),
      onPointerLeave: vi.fn(),
      clearCursor: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      handleClear: vi.fn(),
      loadImg: vi.fn().mockResolvedValue(undefined),
      announce: vi.fn(),
      scheduleCursorRedraw: vi.fn(),
      previewCanvasRef,
      onNewCanvas: vi.fn(),
      panZoomMode: false,
      setPanZoomMode: vi.fn(),
      handleMiddleDown: vi.fn(),
      onPinchDown: vi.fn(),
      onPinchMove: vi.fn(),
      onPinchUp: vi.fn(),
      ...overrides,
    };
    const view = render(<SourcePanel {...props} />);
    return {
      ...view,
      props,
      setBrushSize,
      setPan,
      setZoom,
      saveColor,
      saveGlaze,
      shareColor,
      shareGlaze,
      sourceCanvasRef,
      previewCanvasRef,
    };
  }

  it("routes tool, brush-size, zoom, pan, and mobile save-confirm controls", () => {
    const { props, setBrushSize, setPan, setZoom, saveColor } = renderSource();

    fireEvent.click(screen.getByRole("radio", { name: /tool_eraser/ }));
    expect(props.toolState.setTool).toHaveBeenCalledWith("eraser");
    expect(props.announce).toHaveBeenCalledWith("announce_eraser");

    fireEvent.click(screen.getByLabelText("aria_brush_size_increase"));
    expect(setBrushSize).toHaveBeenCalledWith(expect.any(Function));
    expect((setBrushSize.mock.calls[0][0] as (value: number) => number)(4)).toBe(5);

    const zoomButton = screen.getByRole("button", { name: "aria_zoom_reset(100)" });
    fireEvent.click(zoomButton);
    expect(setZoom).toHaveBeenCalledWith(1);
    expect(setPan).toHaveBeenCalledWith({ x: 0, y: 0 });
    expect(props.scheduleCursorRedraw).toHaveBeenCalled();

    setPan.mockClear();
    const canvasWrap = screen.getByRole("application", { name: "aria_drawing_canvas" }).parentElement!;
    fireEvent.keyDown(canvasWrap, { key: "ArrowRight" });
    expect(setPan).toHaveBeenCalledWith(expect.any(Function));
    expect((setPan.mock.calls[0][0] as (value: { x: number; y: number }) => { x: number; y: number })({ x: 2, y: 3 })).toEqual({
      x: -8,
      y: 3,
    });

    fireEvent.click(screen.getByRole("button", { name: "btn_save_gray" }));
    expect(screen.getByRole("dialog", { name: "confirm_save_gray" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "btn_yes" }));
    expect(saveColor).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringMatching(/^chromalum_gray_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/),
    );
  });

  it("uses save confirmation on pointer-fine devices and keeps share actions immediate", () => {
    mockPointerFine(true);
    const { saveColor, saveGlaze, shareColor, shareGlaze } = renderSource();

    fireEvent.click(screen.getByRole("button", { name: "btn_save_color" }));
    expect(screen.getByRole("dialog", { name: "confirm_save_color" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "btn_yes" }));
    expect(saveColor).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringMatching(/^chromalum_color_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/),
    );

    fireEvent.click(screen.getByRole("button", { name: "btn_save_glaze" }));
    fireEvent.click(screen.getByRole("button", { name: "btn_yes" }));
    expect(saveGlaze).toHaveBeenCalledWith(expect.stringMatching(/^chromalum_glaze_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/));

    fireEvent.contextMenu(screen.getByRole("button", { name: "btn_save_gray" }));
    expect(shareColor).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringMatching(/^chromalum_gray_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/),
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "btn_save_color" }));
    expect(shareColor).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringMatching(/^chromalum_color_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/),
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "btn_save_glaze" }));
    expect(shareGlaze).toHaveBeenCalledWith(expect.stringMatching(/^chromalum_glaze_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/));
  });

  it("does not render export scale controls in the save dialog", () => {
    const { saveColor } = renderSource();

    fireEvent.click(screen.getByRole("button", { name: "btn_save_gray" }));
    const dialog = screen.getByRole("dialog", { name: "confirm_save_gray" });
    expect(within(dialog).queryByRole("radio")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "btn_yes" }));

    expect(saveColor).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringMatching(/^chromalum_gray_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/),
    );
  });

  it("routes pixel-perfect zoom, brush range, level double-click, and pan-mode pointer controls", () => {
    const setTool = vi.fn();
    const setBrushLevel = vi.fn();
    const setBrushSize = vi.fn();
    const setPan = vi.fn();
    const setZoom = vi.fn();
    const state = { ...makeState(true), canvasData: makeCanvasData(128, 64) };
    const { props } = renderSource({
      state,
      toolState: {
        tool: "brush",
        setTool,
        brushLevel: 2,
        setBrushLevel,
        brushSize: 4,
        setBrushSize,
      },
      viewState: {
        zoom: 1,
        setZoom,
        setPan,
        displayWidth: 64,
        displayHeight: 32,
        canvasTransform: {},
        canvasCursor: "crosshair",
      },
      panZoomMode: true,
    });

    fireEvent.contextMenu(screen.getByRole("button", { name: "aria_zoom_reset(100)" }));
    expect(setZoom).toHaveBeenCalledWith(2);
    expect(setPan).toHaveBeenCalledWith({ x: 0, y: 0 });

    fireEvent.change(screen.getByLabelText("aria_brush_size"), { target: { value: "12" } });
    expect(setBrushSize).toHaveBeenCalledWith(12);

    fireEvent.doubleClick(screen.getByLabelText("announce_level(0,Black)"));
    expect(setBrushLevel).toHaveBeenCalledWith(0);
    expect(setTool).toHaveBeenCalledWith("eraser");

    const canvas = screen.getByRole("application", { name: "aria_drawing_canvas" });
    fireEvent.pointerDown(canvas, { button: 0 });
    fireEvent.pointerMove(canvas);
    fireEvent.pointerUp(canvas);
    fireEvent.pointerLeave(canvas);
    fireEvent.mouseLeave(canvas.parentElement!);
    expect(props.onPinchDown).toHaveBeenCalled();
    expect(props.onPinchMove).toHaveBeenCalled();
    expect(props.onPinchUp).toHaveBeenCalledTimes(2);
    expect(props.clearCursor).toHaveBeenCalled();
  });
});

describe("ColorPanel interactions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes keyboard pan/zoom and pointer drawing paths", () => {
    const setZoom = vi.fn();
    const panZoom = makePanZoom({ setZoom });
    const drawing = {
      onPreviewPointerDown: vi.fn(),
      onPreviewPointerMove: vi.fn(),
      onUp: vi.fn(),
      onPreviewPointerLeave: vi.fn(),
      trackPreviewCursor: vi.fn(),
      clearPreviewCursor: vi.fn(),
    };
    render(
      <ColorPanel
        previewCanvasRef={React.createRef<HTMLCanvasElement>()}
        previewCursorRef={React.createRef<HTMLCanvasElement>()}
        previewCanvasWrapRef={React.createRef<HTMLDivElement>()}
        statusRef={React.createRef<HTMLDivElement>()}
        displayWidth={64}
        displayHeight={64}
        canvasTransform={{}}
        canvasCursor="crosshair"
        candidateIndexByLevel={[0, 0, 0, 0, 0, 0, 0, 0]}
        candidateIndexDispatch={vi.fn()}
        brushLevel={2}
        setBrushLevel={vi.fn()}
        tool="brush"
        panZoom={panZoom}
        drawing={drawing}
      />,
    );

    const canvas = screen.getByRole("img", { name: "aria_color_preview_canvas" });
    fireEvent.pointerDown(canvas, { button: 0 });
    expect(drawing.onPreviewPointerDown).toHaveBeenCalled();

    panZoom.panningRef.current = true;
    fireEvent.pointerMove(canvas);
    fireEvent.pointerUp(canvas);
    expect(panZoom.movePan).toHaveBeenCalled();
    expect(panZoom.endPan).toHaveBeenCalled();

    const wrap = screen.getByLabelText("aria_color_preview");
    fireEvent.mouseLeave(wrap);
    expect(drawing.clearPreviewCursor).toHaveBeenCalled();

    fireEvent.keyDown(wrap, { key: "+" });
    expect(setZoom).toHaveBeenCalledWith(expect.any(Function));
    expect((setZoom.mock.calls[0][0] as (value: number) => number)(1)).toBeCloseTo(1.15);
  });
});

describe("GlazePanel interactions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderGlaze(options?: { context?: Partial<GlazeContextValue>; props?: Partial<React.ComponentProps<typeof GlazePanel>> }) {
    const setHueAngleDeg = vi.fn();
    const setGlazeTool = vi.fn();
    const setBrushSize = vi.fn();
    const setCandidateOverridesByLevel = vi.fn();
    const context: GlazeContextValue = {
      hueAngleDeg: 45,
      setHueAngleDeg,
      glazeTool: "glaze_brush",
      setGlazeTool,
      brushSize: 4,
      setBrushSize,
      candidateOverridesByLevel: new Map([[2, 0]]),
      setCandidateOverridesByLevel,
      ...options?.context,
    };
    const panZoom = makePanZoom();
    const glazeDrawing = makeGlazeDrawing();
    const props: React.ComponentProps<typeof GlazePanel> = {
      previewCanvasRef: React.createRef<HTMLCanvasElement>(),
      previewCanvasWrapRef: React.createRef<HTMLDivElement>(),
      displayWidth: 64,
      displayHeight: 64,
      canvasTransform: {},
      canvasCursor: "crosshair",
      canvasData: { ...makeCanvasData(), pixelCandidateOverrideMap: new Uint8Array([0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) },
      dispatch: vi.fn(),
      panZoom,
      glazeDrawing,
      announce: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      zoom: 1,
      brushLevel: 2,
      panZoomMode: false,
      setPanZoomMode: vi.fn(),
      onPinchDown: vi.fn(),
      onPinchMove: vi.fn(),
      onPinchUp: vi.fn(),
      ...options?.props,
    };
    const view = render(
      <GlazeContextProvider {...context}>
        <GlazePanel {...props} />
      </GlazeContextProvider>,
    );
    return { ...view, props, context, panZoom, glazeDrawing, setHueAngleDeg, setGlazeTool, setBrushSize, setCandidateOverridesByLevel };
  }

  it("routes tool shortcuts, hue selection, clear action, and canvas pointer modes", () => {
    const { props, panZoom, glazeDrawing, setHueAngleDeg, setGlazeTool, setBrushSize, setCandidateOverridesByLevel } = renderGlaze();

    fireEvent.click(screen.getByRole("radio", { name: /tool_glaze_fill/ }));
    expect(setGlazeTool).toHaveBeenCalledWith("glaze_fill");
    expect(props.announce).toHaveBeenCalledWith("announce_glaze_fill");

    fireEvent.change(screen.getByLabelText("aria_hue_slider"), { target: { value: "120" } });
    expect(setHueAngleDeg).toHaveBeenCalledWith(120);
    expect(setCandidateOverridesByLevel).toHaveBeenCalledWith(new Map());

    fireEvent.click(screen.getByRole("button", { name: "btn_glaze_clear" }));
    expect(props.dispatch).toHaveBeenCalledWith({ type: "glaze_clear" });
    expect(screen.getByText("2px")).toBeTruthy();

    const canvas = screen.getByRole("img", { name: "label_glaze" });
    fireEvent.pointerDown(canvas, { button: 2 });
    expect(glazeDrawing.pickHue).toHaveBeenCalled();

    fireEvent.pointerDown(canvas, { button: 0 });
    expect(glazeDrawing.onWorkspaceDown).toHaveBeenCalled();

    panZoom.panningRef.current = true;
    fireEvent.pointerMove(canvas);
    fireEvent.pointerUp(canvas);
    expect(panZoom.movePan).toHaveBeenCalled();
    expect(panZoom.endPan).toHaveBeenCalled();
    fireEvent.mouseLeave(canvas.parentElement!);
    expect(glazeDrawing.clearCursor).toHaveBeenCalled();

    const wrap = canvas.parentElement!;
    fireEvent.keyDown(wrap, { key: "]" });
    expect(setBrushSize).toHaveBeenCalledWith(expect.any(Function));
    expect((setBrushSize.mock.calls[0][0] as (value: number) => number)(4)).toBe(5);
  });

  it("keeps brush size controls visible for the glaze fill tool", () => {
    renderGlaze({ context: { glazeTool: "glaze_fill" } });

    expect(screen.getByLabelText("aria_brush_size")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("lets direct candidate swatches opt a level into and out of manual selection", () => {
    const { setCandidateOverridesByLevel } = renderGlaze({ context: { candidateOverridesByLevel: new Map() } });
    const candidateButtons = screen.getAllByRole("button").filter((button) => button.getAttribute("title")?.startsWith("#"));
    expect(candidateButtons.length).toBeGreaterThan(0);

    fireEvent.click(candidateButtons[0]);
    expect(setCandidateOverridesByLevel).toHaveBeenCalledWith(expect.any(Function));
    const updated = (setCandidateOverridesByLevel.mock.calls[0][0] as (value: Map<number, number>) => Map<number, number>)(new Map());
    expect(updated.size).toBe(1);
  });

  it("routes keyboard tool switching, zoom reset, and pan-mode pointer controls", () => {
    const setZoom = vi.fn();
    const setPan = vi.fn();
    const scheduleCursorRedraw = vi.fn();
    const { props, panZoom, setGlazeTool } = renderGlaze({
      props: {
        panZoomMode: true,
        panZoom: makePanZoom({ setZoom, setPan, scheduleCursorRedrawRef: { current: scheduleCursorRedraw } }),
      },
    });

    const canvas = screen.getByRole("img", { name: "label_glaze" });
    const wrap = canvas.parentElement!;

    fireEvent.keyDown(wrap, { key: "e" });
    expect(setGlazeTool).toHaveBeenCalledWith("glaze_eraser");
    expect(props.announce).toHaveBeenCalledWith("announce_glaze_eraser");

    fireEvent.keyDown(wrap, { key: "0" });
    expect(setZoom).toHaveBeenCalledWith(1);
    expect(setPan).toHaveBeenCalledWith({ x: 0, y: 0 });
    expect(scheduleCursorRedraw).toHaveBeenCalled();

    fireEvent.pointerDown(canvas, { button: 0 });
    fireEvent.pointerMove(canvas);
    fireEvent.pointerUp(canvas);
    fireEvent.pointerLeave(canvas);
    expect(props.onPinchDown).toHaveBeenCalled();
    expect(props.onPinchMove).toHaveBeenCalled();
    expect(props.onPinchUp).toHaveBeenCalledTimes(2);
    expect(panZoom.startPan).not.toHaveBeenCalled();
  });
});

describe("CropModal interactions", () => {
  beforeEach(() => {
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = vi.fn();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clamps a corner resize and confirms the selected image crop", () => {
    const onConfirm = vi.fn();
    const { container } = render(
      <CropModal img={document.createElement("img")} imgW={64} imgH={64} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    const nwHandle = container.querySelector('div[style*="nw-resize"]') as HTMLElement;
    expect(nwHandle).toBeTruthy();

    fireEvent.pointerDown(nwHandle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(nwHandle, { clientX: 10, clientY: 12, pointerId: 1 });
    fireEvent.pointerUp(nwHandle, { pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: "btn_ok" }));

    expect(onConfirm).toHaveBeenCalledWith(10, 12, 54, 52);
  });
});

describe("MapCanvas rendering and inspection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders every map mode and reports per-pixel hover details", () => {
    const putImageData = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- HTMLCanvasElement#getContext has incompatible overloads in tests
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (_contextId: string): any {
      return {
        createImageData: (width: number, height: number) => new ImageData(width, height),
        putImageData,
      };
    });

    const canvasData = { ...makeCanvasData(2, 2), levelData: new Uint8Array([0, 2, 5, 7]) };
    const pixelMaps = makePixelMaps(2, 2);
    const { container, rerender } = render(
      <MapCanvas
        mode="levelTone"
        pixelMaps={pixelMaps}
        colorLUT={colorLUT}
        candidateIndexByLevel={DEFAULT_CANDIDATE_INDEX_BY_LEVEL}
        canvasData={canvasData}
        displayWidth={20}
        displayHeight={20}
      />,
    );

    for (const mode of ["diversity", "isolation", "boundaryDistance", "levelTone", "colorLuma", "gradient", "region"] satisfies MapMode[]) {
      rerender(
        <MapCanvas
          mode={mode}
          pixelMaps={pixelMaps}
          colorLUT={colorLUT}
          candidateIndexByLevel={DEFAULT_CANDIDATE_INDEX_BY_LEVEL}
          canvasData={canvasData}
          displayWidth={20}
          displayHeight={20}
        />,
      );
    }
    expect(putImageData).toHaveBeenCalledTimes(8);
    expect(screen.getByText("\u2014")).toBeTruthy();

    const canvas = container.querySelector("canvas")!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 20,
      height: 20,
      right: 20,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.mouseMove(canvas, { clientX: 5, clientY: 5 });
    expect(screen.getByText(/\(0,0\) MapRegion L0 base c1\/1 #000000 region#/)).toBeTruthy();
    fireEvent.mouseLeave(canvas);
    expect(screen.queryByText(/\(0,0\) MapRegion L0 base c1\/1 #000000 region#/)).toBeNull();
    expect(screen.getByText("\u2014")).toBeTruthy();
  });

  it("clears stale worker output instead of painting mismatched pixel-map dimensions", () => {
    const putImageData = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- HTMLCanvasElement#getContext has incompatible overloads in tests
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (_contextId: string): any {
      return {
        createImageData: (width: number, height: number) => new ImageData(width, height),
        putImageData,
      };
    });

    render(
      <MapCanvas
        mode="isolation"
        pixelMaps={makePixelMaps(1, 1)}
        colorLUT={colorLUT}
        candidateIndexByLevel={DEFAULT_CANDIDATE_INDEX_BY_LEVEL}
        canvasData={makeCanvasData(2, 2)}
        displayWidth={20}
        displayHeight={20}
      />,
    );

    expect(putImageData).toHaveBeenCalledOnce();
    expect((putImageData.mock.calls[0][0] as ImageData).data.every((value) => value === 0)).toBe(true);
  });

  it("clears pending same-sized map output and reports pending on hover", () => {
    const putImageData = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- HTMLCanvasElement#getContext has incompatible overloads in tests
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (_contextId: string): any {
      return {
        createImageData: (width: number, height: number) => new ImageData(width, height),
        putImageData,
      };
    });

    const pixelMaps = { ...makePixelMaps(2, 2), neighborIsolation: new Float32Array(0) };
    const { container } = render(
      <MapCanvas
        mode="isolation"
        pixelMaps={pixelMaps}
        colorLUT={colorLUT}
        candidateIndexByLevel={DEFAULT_CANDIDATE_INDEX_BY_LEVEL}
        canvasData={makeCanvasData(2, 2)}
        displayWidth={20}
        displayHeight={20}
      />,
    );

    expect(putImageData).toHaveBeenCalledOnce();
    expect((putImageData.mock.calls[0][0] as ImageData).data.every((value) => value === 0)).toBe(true);

    const canvas = container.querySelector("canvas")!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 20,
      height: 20,
      right: 20,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.mouseMove(canvas, { clientX: 5, clientY: 5 });
    expect(screen.getByText("(0,0) MapIsolation L0 pending")).toBeTruthy();
  });
});
