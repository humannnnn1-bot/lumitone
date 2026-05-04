// @vitest-environment jsdom
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../../i18n";
import type { MusicEngineReturn } from "../../../hooks/useMusicEngine";
import { MusicAlgebraPanel } from "../MusicAlgebraPanel";
import { MusicFanoControls } from "../MusicFanoControls";
import { MusicTransportControls } from "../MusicTransportControls";

type TransportProps = ComponentProps<typeof MusicTransportControls>;
type FanoProps = ComponentProps<typeof MusicFanoControls>;
type AlgebraProps = ComponentProps<typeof MusicAlgebraPanel>;

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

function makeAlgebraProps(overrides: Partial<AlgebraProps> = {}): AlgebraProps {
  return {
    engine: makeMusicEngine(),
    activeLevels: [],
    stopSignal: 0,
    resetSignal: 0,
    cayleyRow: 1,
    onCayleyRowChange: mockFn<AlgebraProps["onCayleyRowChange"]>(),
    cayleyCol: -1,
    onCayleyColChange: mockFn<AlgebraProps["onCayleyColChange"]>(),
    distA: 5,
    onDistAChange: mockFn<AlgebraProps["onDistAChange"]>(),
    distB: 3,
    onDistBChange: mockFn<AlgebraProps["onDistBChange"]>(),
    distC: 6,
    onDistCChange: mockFn<AlgebraProps["onDistCChange"]>(),
    distPhase: null,
    onDistPhaseChange: mockFn<AlgebraProps["onDistPhaseChange"]>(),
    andStep: null,
    onAndStepChange: mockFn<AlgebraProps["onAndStepChange"]>(),
    errorPos: 1,
    errorPhase: null,
    onErrorPosChange: mockFn<AlgebraProps["onErrorPosChange"]>(),
    onErrorPhaseChange: mockFn<AlgebraProps["onErrorPhaseChange"]>(),
    hammingMode: "743",
    onHammingModeChange: mockFn<AlgebraProps["onHammingModeChange"]>(),
    weightPlaying: false,
    onWeightPlayingChange: mockFn<AlgebraProps["onWeightPlayingChange"]>(),
    weightStep: null,
    onWeightStepChange: mockFn<AlgebraProps["onWeightStepChange"]>(),
    onHoveredFanoLineChange: mockFn<AlgebraProps["onHoveredFanoLineChange"]>(),
    octaA: 1,
    onOctaAChange: mockFn<AlgebraProps["onOctaAChange"]>(),
    octaB: 2,
    onOctaBChange: mockFn<AlgebraProps["onOctaBChange"]>(),
    octaPhase: null,
    onOctaPhaseChange: mockFn<AlgebraProps["onOctaPhaseChange"]>(),
    gray3Playing: false,
    onGray3PlayingChange: mockFn<AlgebraProps["onGray3PlayingChange"]>(),
    gray3Code: null,
    onGray3CodeChange: mockFn<AlgebraProps["onGray3CodeChange"]>(),
    k8Layer: null,
    onK8LayerChange: mockFn<AlgebraProps["onK8LayerChange"]>(),
    tetraPhase: null,
    onTetraPhaseChange: mockFn<AlgebraProps["onTetraPhaseChange"]>(),
    gl32Perm: [0, 1, 2, 3, 4, 5, 6, 7],
    onGl32PermChange: mockFn<AlgebraProps["onGl32PermChange"]>(),
    gl32Flash: false,
    onGl32FlashChange: mockFn<AlgebraProps["onGl32FlashChange"]>(),
    ...overrides,
  };
}

describe("MusicPanel section components", () => {
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

    fireEvent.change(screen.getByLabelText("Alpha speed"), { target: { value: "54" } });
    expect(props.onAlphaSpeedChange).toHaveBeenCalledWith(54);

    fireEvent.change(screen.getByLabelText("Phase drift"), { target: { value: "12" } });
    expect(props.onPhaseSpeedChange).toHaveBeenCalledWith(12);

    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(props.onMuteToggle).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "25" } });
    expect(props.onVolumeChange).toHaveBeenCalledWith(0.25);
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
    expect(props.onCayleyRowChange).toHaveBeenCalledWith(4);

    fireEvent.click(screen.getByRole("button", { name: "\u25b6 Row" }));
    expect(engine.initAudio).toHaveBeenCalled();
    expect(engine.playCayleyRow).toHaveBeenCalledWith(1, expect.any(Function));
    expect(props.onCayleyColChange).toHaveBeenCalledWith(3);
  });

  it("routes algebra stop, octahedron, and GL(3,2) callbacks", () => {
    const engine = makeMusicEngine({
      applyGL32Transform: vi.fn((_generator, onPerm) => onPerm?.([7, 6, 5, 4, 3, 2, 1, 0])),
    });
    const props = makeAlgebraProps({
      engine,
      cayleyCol: 2,
      octaA: 1,
      octaB: 1,
    });
    const view = renderWithLanguage(<MusicAlgebraPanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "\u23f9 Row" }));
    expect(engine.stopAlgebra).toHaveBeenCalled();
    expect(props.onCayleyColChange).toHaveBeenCalledWith(-1);

    const invalidOcta = screen.getByRole("button", { name: "\u25b6 Octa" }) as HTMLButtonElement;
    expect(invalidOcta.disabled).toBe(true);

    const validProps = { ...props, octaA: 1, octaB: 2, cayleyCol: -1 };
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
    expect(props.onGl32PermChange).toHaveBeenCalledWith([7, 6, 5, 4, 3, 2, 1, 0]);
    expect(props.onGl32FlashChange).toHaveBeenCalledWith(true);
  });
});
