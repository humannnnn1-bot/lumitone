// @vitest-environment jsdom
import { useState, type ComponentProps, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LEVEL_CANDIDATES } from "../../../color-engine";
import { LanguageProvider } from "../../../i18n";
import type { MusicEngineReturn } from "../../../hooks/useMusicEngine";
import type { DecoderPhase } from "../../../music/types";
import { ErrorCorrectionCard } from "../ErrorCorrectionCard";
import { MusicAlgebraPanel } from "../MusicAlgebraPanel";
import { MusicFanoControls } from "../MusicFanoControls";
import { MusicHueAlphaControls } from "../MusicHueAlphaControls";
import { MusicLevelCandidateGrid } from "../MusicLevelCandidateGrid";
import { MusicTransportControls } from "../MusicTransportControls";

type TransportProps = ComponentProps<typeof MusicTransportControls>;
type FanoProps = ComponentProps<typeof MusicFanoControls>;
type AlgebraProps = ComponentProps<typeof MusicAlgebraPanel>;
type HueAlphaProps = ComponentProps<typeof MusicHueAlphaControls>;
type CandidateGridProps = ComponentProps<typeof MusicLevelCandidateGrid>;

function renderWithLanguage(node: ReactNode) {
  localStorage.setItem("chromalum_lang", "en");
  return render(<LanguageProvider>{node}</LanguageProvider>);
}

function mockFn<T extends (...args: never[]) => unknown>() {
  return vi.fn() as unknown as T;
}

function makeMusicEngine(overrides: Partial<MusicEngineReturn> = {}): MusicEngineReturn {
  return {
    initAudio: vi.fn(),
    stopAudio: vi.fn(),
    triggerToneBurst: vi.fn(),
    playGrayMelody: vi.fn(),
    stopGrayMelody: vi.fn(),
    startFanoRhythm: vi.fn(),
    stopFanoRhythm: vi.fn(),
    analyserNode: null,
    playXorTriple: vi.fn(),
    playParityChord: vi.fn(),
    playComplementChord: vi.fn(),
    playLineAndComplement: vi.fn(),
    playSyndromeDemo: vi.fn(),
    playGray3Voice: vi.fn(),
    playWeightSpectrum: vi.fn(),
    playCayleyRow: vi.fn(),
    applyGL32Transform: vi.fn(),
    resetGL32Transform: vi.fn(),
    setLuminanceMode: vi.fn(),
    stopAlgebra: vi.fn(),
    setDroneMuted: vi.fn(),
    playComplementCanon: vi.fn(),
    playZigzagMelody: vi.fn(),
    stopZigzagMelody: vi.fn(),
    playPointFanoContext: vi.fn(),
    playExtendedHamming: vi.fn(),
    playDistributiveLaw: vi.fn(),
    playAndTriads: vi.fn(),
    playOctahedronMix: vi.fn(),
    playTetraSplit: vi.fn(),
    playTetraT0: vi.fn(),
    playTetraT1: vi.fn(),
    playK8Layer: vi.fn(),
    ...overrides,
  };
}

function makeTransportProps(overrides: Partial<TransportProps> = {}): TransportProps {
  return {
    scaleMode: "diatonic7",
    onScaleModeChange: mockFn<TransportProps["onScaleModeChange"]>(),
    onStopAll: vi.fn(),
    onResetDefaults: vi.fn(),
    luminanceMode: "symmetric",
    onLuminanceModeChange: mockFn<TransportProps["onLuminanceModeChange"]>(),
    fmEnabled: false,
    onFmEnabledChange: vi.fn(),
    hueDir: 0,
    onHueReverse: vi.fn(),
    onHuePlay: vi.fn(),
    hueSpeed: 36,
    onHueSpeedChange: vi.fn(),
    alphaDir: 0,
    onAlphaReverse: vi.fn(),
    onAlphaPlay: vi.fn(),
    alphaSpeed: 36,
    onAlphaSpeedChange: vi.fn(),
    phaseSpeed: 0,
    onPhaseSpeedChange: vi.fn(),
    muted: false,
    volume: 0.7,
    onMuteToggle: vi.fn(),
    onVolumeChange: vi.fn(),
    ...overrides,
  };
}

function makeFanoProps(overrides: Partial<FanoProps> = {}): FanoProps {
  return {
    hoveredFanoLine: null,
    onHoveredFanoLineChange: mockFn<FanoProps["onHoveredFanoLineChange"]>(),
    onFanoNodeClick: vi.fn(),
    onFanoLineClick: vi.fn(),
    activeLevels: [],
    grayStep: null,
    xorStep: null,
    rhythmPlaying: false,
    rhythmFiringLines: [],
    partitionPhase: null,
    partitionLineIndex: 0,
    xorA: null,
    xorB: null,
    onXorAChange: mockFn<FanoProps["onXorAChange"]>(),
    onXorBChange: mockFn<FanoProps["onXorBChange"]>(),
    onPlayXor: vi.fn(),
    fanoContextPoint: 1,
    onFanoContextPointChange: vi.fn(),
    fanoContextLine: -1,
    onPlayPointContext: vi.fn(),
    selectedFanoLine: 0,
    onSelectedFanoLineChange: vi.fn(),
    onPlayPartition: vi.fn(),
    onGrayMelody: vi.fn(),
    onFanoRhythm: vi.fn(),
    rhythmTempo: 120,
    onRhythmTempoChange: vi.fn(),
    ...overrides,
  };
}

type AlgebraPropsOverrides = Omit<
  Partial<AlgebraProps>,
  "cayley" | "distributive" | "andTriads" | "errorCorrection" | "hamming" | "octahedron" | "gray3" | "polyhedra" | "gl32"
> & {
  cayley?: Partial<AlgebraProps["cayley"]>;
  distributive?: Partial<AlgebraProps["distributive"]>;
  andTriads?: Partial<AlgebraProps["andTriads"]>;
  errorCorrection?: Partial<AlgebraProps["errorCorrection"]>;
  hamming?: Partial<AlgebraProps["hamming"]>;
  octahedron?: Partial<AlgebraProps["octahedron"]>;
  gray3?: Partial<AlgebraProps["gray3"]>;
  polyhedra?: Partial<AlgebraProps["polyhedra"]>;
  gl32?: Partial<AlgebraProps["gl32"]>;
};

function makeAlgebraProps(overrides: AlgebraPropsOverrides = {}): AlgebraProps {
  const props: AlgebraProps = {
    engine: makeMusicEngine(),
    activeLevels: [],
    stopSignal: 0,
    resetSignal: 0,
    cayley: {
      row: 1,
      onRowChange: mockFn<AlgebraProps["cayley"]["onRowChange"]>(),
      col: -1,
      onColChange: mockFn<AlgebraProps["cayley"]["onColChange"]>(),
    },
    distributive: {
      a: 5,
      onAChange: mockFn<AlgebraProps["distributive"]["onAChange"]>(),
      b: 3,
      onBChange: mockFn<AlgebraProps["distributive"]["onBChange"]>(),
      c: 6,
      onCChange: mockFn<AlgebraProps["distributive"]["onCChange"]>(),
      phase: null,
      onPhaseChange: mockFn<AlgebraProps["distributive"]["onPhaseChange"]>(),
    },
    andTriads: {
      step: null,
      onStepChange: mockFn<AlgebraProps["andTriads"]["onStepChange"]>(),
    },
    errorCorrection: {
      pos: 1,
      phase: null,
      onPosChange: mockFn<AlgebraProps["errorCorrection"]["onPosChange"]>(),
      onPhaseChange: mockFn<AlgebraProps["errorCorrection"]["onPhaseChange"]>(),
    },
    hamming: {
      mode: "743",
      onModeChange: mockFn<AlgebraProps["hamming"]["onModeChange"]>(),
      weightPlaying: false,
      onWeightPlayingChange: mockFn<AlgebraProps["hamming"]["onWeightPlayingChange"]>(),
      weightStep: null,
      onWeightStepChange: mockFn<AlgebraProps["hamming"]["onWeightStepChange"]>(),
      onHoveredFanoLineChange: mockFn<AlgebraProps["hamming"]["onHoveredFanoLineChange"]>(),
    },
    octahedron: {
      a: 1,
      onAChange: mockFn<AlgebraProps["octahedron"]["onAChange"]>(),
      b: 2,
      onBChange: mockFn<AlgebraProps["octahedron"]["onBChange"]>(),
      phase: null,
      onPhaseChange: mockFn<AlgebraProps["octahedron"]["onPhaseChange"]>(),
    },
    gray3: {
      playing: false,
      onPlayingChange: mockFn<AlgebraProps["gray3"]["onPlayingChange"]>(),
      code: null,
      onCodeChange: mockFn<AlgebraProps["gray3"]["onCodeChange"]>(),
    },
    polyhedra: {
      k8Layer: null,
      onK8LayerChange: mockFn<AlgebraProps["polyhedra"]["onK8LayerChange"]>(),
      tetraPhase: null,
      onTetraPhaseChange: mockFn<AlgebraProps["polyhedra"]["onTetraPhaseChange"]>(),
    },
    gl32: {
      perm: [0, 1, 2, 3, 4, 5, 6, 7],
      onPermChange: mockFn<AlgebraProps["gl32"]["onPermChange"]>(),
      flash: false,
      onFlashChange: mockFn<AlgebraProps["gl32"]["onFlashChange"]>(),
    },
  };

  return {
    ...props,
    ...overrides,
    cayley: { ...props.cayley, ...overrides.cayley },
    distributive: { ...props.distributive, ...overrides.distributive },
    andTriads: { ...props.andTriads, ...overrides.andTriads },
    errorCorrection: { ...props.errorCorrection, ...overrides.errorCorrection },
    hamming: { ...props.hamming, ...overrides.hamming },
    octahedron: { ...props.octahedron, ...overrides.octahedron },
    gray3: { ...props.gray3, ...overrides.gray3 },
    polyhedra: { ...props.polyhedra, ...overrides.polyhedra },
    gl32: { ...props.gl32, ...overrides.gl32 },
  };
}

function makeHueAlphaProps(overrides: Partial<HueAlphaProps> = {}): HueAlphaProps {
  return {
    hueAngle: 90,
    alpha0: 45,
    hueTicks: [{ deg: 30, color: "rgb(255,0,0)" }],
    onHueChange: vi.fn(),
    onAlphaChange: vi.fn(),
    ...overrides,
  };
}

function makeLevelPreview(lv: number) {
  const cand = LEVEL_CANDIDATES[lv][0];
  return {
    lv,
    name: `L${lv}`,
    rgb: cand.rgb,
    hex: `rgb(${cand.rgb.join(",")})`,
  };
}

function ErrorCorrectionHarness({ engine }: { engine: MusicEngineReturn }) {
  const [errorPos, setErrorPos] = useState(1);
  const [errorPhase, setErrorPhase] = useState<DecoderPhase>(null);

  return (
    <ErrorCorrectionCard
      engine={engine}
      activeLevels={[]}
      stopSignal={0}
      errorPos={errorPos}
      errorPhase={errorPhase}
      onErrorPosChange={setErrorPos}
      onErrorPhaseChange={setErrorPhase}
    />
  );
}

function makeCandidateGridProps(overrides: Partial<CandidateGridProps> = {}): CandidateGridProps {
  return {
    levelPreview: [makeLevelPreview(2)],
    hueAngle: LEVEL_CANDIDATES[2][0].angle,
    directCandidates: new Map([[2, 0]]),
    selectedLevels: new Set(),
    burstHighlight: new Set(),
    hoveredCandidate: null,
    onDirectCandidatesChange: mockFn<CandidateGridProps["onDirectCandidatesChange"]>(),
    onSelectedLevelsChange: mockFn<CandidateGridProps["onSelectedLevelsChange"]>(),
    onHoveredCandidateChange: mockFn<CandidateGridProps["onHoveredCandidateChange"]>(),
    onBlockClick: vi.fn(),
    ...overrides,
  };
}

describe("MusicPanel section components", () => {
  it("routes hue and alpha slider changes", () => {
    const props = makeHueAlphaProps();
    renderWithLanguage(<MusicHueAlphaControls {...props} />);

    expect(screen.getByText("Hue Angle: 90°")).toBeTruthy();
    expect(screen.getByText("Hue Phase: 45°")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Hue angle (0-359 degrees)"), { target: { value: "120" } });
    expect(props.onHueChange).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Hue phase"), { target: { value: "180" } });
    expect(props.onAlphaChange).toHaveBeenCalled();
  });

  it("routes candidate grid click and keyboard activation", () => {
    const props = makeCandidateGridProps();
    renderWithLanguage(<MusicLevelCandidateGrid {...props} />);

    const candidates = screen.getAllByRole("button", { name: /Level 2 color candidate/ });
    fireEvent.click(candidates[0]);
    expect(props.onDirectCandidatesChange).toHaveBeenCalled();
    expect(props.onSelectedLevelsChange).toHaveBeenCalled();
    expect(props.onHoveredCandidateChange).toHaveBeenCalledWith(null);
    expect(props.onBlockClick).toHaveBeenCalledWith(2, expect.any(Number));

    fireEvent.keyDown(candidates[0], { key: "Enter" });
    expect(props.onBlockClick).toHaveBeenCalledTimes(2);
  });

  it("marks selected candidate grid levels as pressed", () => {
    const props = makeCandidateGridProps({ selectedLevels: new Set([2]) });
    renderWithLanguage(<MusicLevelCandidateGrid {...props} />);

    expect(screen.getAllByRole("button", { pressed: true })[0]).toBeTruthy();
  });

  it("routes transport scale, mode, rotation, mute, and volume callbacks", () => {
    const props = makeTransportProps();
    renderWithLanguage(<MusicTransportControls {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Just" }));
    expect(props.onScaleModeChange).toHaveBeenCalledWith("ji");

    fireEvent.click(screen.getByRole("button", { name: "Stop All" }));
    expect(props.onStopAll).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(props.onResetDefaults).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Luma" }));
    expect(props.onLuminanceModeChange).toHaveBeenCalledWith("luminance");

    fireEvent.click(screen.getByRole("button", { name: "FM" }));
    expect(props.onFmEnabledChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Auto-rotate hue backward" }));
    expect(props.onHueReverse).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Auto-rotate hue forward" }));
    expect(props.onHuePlay).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Hue speed"), { target: { value: "48" } });
    expect(props.onHueSpeedChange).toHaveBeenCalledWith(48);

    fireEvent.change(screen.getByLabelText("Hue phase speed"), { target: { value: "54" } });
    expect(props.onAlphaSpeedChange).toHaveBeenCalledWith(54);

    fireEvent.change(screen.getByLabelText("Phase drift"), { target: { value: "12" } });
    expect(props.onPhaseSpeedChange).toHaveBeenCalledWith(12);

    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(props.onMuteToggle).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "25" } });
    expect(props.onVolumeChange).toHaveBeenCalledWith(0.25);
  });

  it("uses fixed-height buttons for rotation and volume controls", () => {
    const props = makeTransportProps();
    renderWithLanguage(<MusicTransportControls {...props} />);

    for (const name of [
      "Auto-rotate hue backward",
      "Auto-rotate hue forward",
      "Auto-rotate hue phase backward",
      "Auto-rotate hue phase forward",
      "Mute",
    ]) {
      const button = screen.getByRole("button", { name });
      expect(button.style.height).toBe("22px");
      expect(button.style.fontSize).toBe("11px");
      expect(button.style.lineHeight).toBe("1");
      expect(button.style.minWidth).toBe("36px");
    }
  });

  it("routes Fano selectors and keeps XOR play disabled until both operands are selected", () => {
    const props = makeFanoProps();
    renderWithLanguage(<MusicFanoControls {...props} />);

    const playXor = screen.getByRole("button", { name: "\u25b6 XOR" }) as HTMLButtonElement;
    expect(playXor.disabled).toBe(true);

    fireEvent.change(screen.getByRole("combobox", { name: "XOR first color" }), { target: { value: "3" } });
    expect(props.onXorAChange).toHaveBeenCalledWith(3);

    fireEvent.change(screen.getByRole("combobox", { name: "XOR second color" }), { target: { value: "5" } });
    expect(props.onXorBChange).toHaveBeenCalledWith(5);

    fireEvent.change(screen.getByRole("combobox", { name: "Fano point" }), { target: { value: "6" } });
    expect(props.onFanoContextPointChange).toHaveBeenCalledWith(6);

    fireEvent.change(screen.getByRole("combobox", { name: "Fano line" }), { target: { value: "2" } });
    expect(props.onSelectedFanoLineChange).toHaveBeenCalledWith(2);

    fireEvent.change(screen.getByLabelText("BPM"), { target: { value: "160" } });
    expect(props.onRhythmTempoChange).toHaveBeenCalledWith(160);

    fireEvent.click(screen.getByRole("button", { name: "\u25b6 Gray" }));
    expect(props.onGrayMelody).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "\u25b6 Rhythm" }));
    expect(props.onFanoRhythm).toHaveBeenCalled();
  });

  it("enables Fano XOR playback when both operands are present", () => {
    const props = makeFanoProps({ xorA: 1, xorB: 2 });
    renderWithLanguage(<MusicFanoControls {...props} />);

    const playXor = screen.getByRole("button", { name: "\u25b6 XOR" }) as HTMLButtonElement;
    expect(playXor.disabled).toBe(false);
    fireEvent.click(playXor);
    expect(props.onPlayXor).toHaveBeenCalled();
  });

  it("routes algebra selectors and Cayley play callbacks", () => {
    const engine = makeMusicEngine({
      playCayleyRow: vi.fn((_row, onStep) => onStep(3, 2)),
    });
    const props = makeAlgebraProps({ engine });
    renderWithLanguage(<MusicAlgebraPanel {...props} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Cayley row" }), { target: { value: "4" } });
    expect(props.cayley.onRowChange).toHaveBeenCalledWith(4);

    fireEvent.click(screen.getByRole("button", { name: "\u25b6 Row" }));
    expect(engine.initAudio).toHaveBeenCalled();
    expect(engine.playCayleyRow).toHaveBeenCalledWith(1, expect.any(Function));
    expect(props.cayley.onColChange).toHaveBeenCalledWith(3);
  });

  it("starts syndrome playback for the selected error position", () => {
    const engine = makeMusicEngine({
      playSyndromeDemo: vi.fn((_errorPos, onPhase) => onPhase("syndrome")),
    });

    renderWithLanguage(<ErrorCorrectionHarness engine={engine} />);

    fireEvent.change(screen.getByLabelText("Error position"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "\u25b6 Syndrome" }));

    expect(engine.initAudio).toHaveBeenCalled();
    expect(engine.playSyndromeDemo).toHaveBeenCalledWith(6, expect.any(Function));
    expect(screen.getByText("Syndrome")).toBeTruthy();
    expect(screen.getByText("s\u2082s\u2081s\u2080 = 110 \u2192 pos 6")).toBeTruthy();
  });

  it("routes algebra stop, octahedron, and GL(3,2) callbacks", () => {
    const engine = makeMusicEngine({
      applyGL32Transform: vi.fn((_generator, onPerm) => onPerm?.([7, 6, 5, 4, 3, 2, 1, 0])),
    });
    const props = makeAlgebraProps({
      engine,
      cayley: { col: 2 },
      octahedron: { a: 1, b: 1 },
    });
    const view = renderWithLanguage(<MusicAlgebraPanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "\u23f9 Row" }));
    expect(engine.stopAlgebra).toHaveBeenCalled();
    expect(props.cayley.onColChange).toHaveBeenCalledWith(-1);

    const invalidOcta = screen.getByRole("button", { name: "\u25b6 Octa" }) as HTMLButtonElement;
    expect(invalidOcta.disabled).toBe(true);

    const validProps = {
      ...props,
      cayley: { ...props.cayley, col: -1 },
      octahedron: { ...props.octahedron, a: 1, b: 2 },
    };
    view.rerender(
      <LanguageProvider>
        <MusicAlgebraPanel {...validProps} />
      </LanguageProvider>,
    );

    const validOcta = screen.getByRole("button", { name: "\u25b6 Octa" }) as HTMLButtonElement;
    expect(validOcta.disabled).toBe(false);
    fireEvent.click(validOcta);
    expect(engine.playOctahedronMix).toHaveBeenCalledWith(1, 2, expect.any(Function));

    fireEvent.click(screen.getByRole("button", { name: "Gen B" }));
    expect(engine.applyGL32Transform).toHaveBeenCalledWith("B", expect.any(Function));
    expect(props.gl32.onPermChange).toHaveBeenCalledWith([7, 6, 5, 4, 3, 2, 1, 0]);
    expect(props.gl32.onFlashChange).toHaveBeenCalledWith(true);
  });
});
