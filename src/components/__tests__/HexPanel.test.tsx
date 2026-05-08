// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CC } from "../../color-engine";
import type { CanvasData } from "../../types";
import { HexPanel } from "../HexPanel";

vi.mock("../../i18n", () => ({
  useTranslation: () => ({
    t: (key: string, ...args: unknown[]) => (args.length ? `${key}(${args.join(",")})` : key),
  }),
}));

const t = ((key: string, ...args: unknown[]) => (args.length ? `${key}(${args.join(",")})` : key)) as React.ComponentProps<
  typeof HexPanel
>["t"];

function makeCvs(): CanvasData {
  const data = new Uint8Array(4);
  data.set([0, 3, 4, 7]);
  return { w: 2, h: 2, data, colorMap: new Uint8Array(4) };
}

function makeProps(overrides?: Partial<React.ComponentProps<typeof HexPanel>>): React.ComponentProps<typeof HexPanel> {
  return {
    hexPrvRef: React.createRef<HTMLCanvasElement>(),
    cvs: makeCvs(),
    displayW: 128,
    displayH: 96,
    cc: [...DEFAULT_CC],
    ccDispatch: vi.fn(),
    hist: [1, 2, 3, 4, 5, 6, 7, 8],
    total: 36,
    locked: new Array(8).fill(false),
    toggleLock: vi.fn(),
    handleRandomize: vi.fn(),
    handleUnlockAll: vi.fn(),
    canRandomize: true,
    patternInfo: { total: 42, expanded: "1 x 2 x 3", perLevel: [1, 2, 3, 4, 5, 6, 7, 8] },
    t,
    ...overrides,
  };
}

describe("HexPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cycles color candidates from document keyboard shortcuts and ignores modified keys", () => {
    const props = makeProps();
    render(<HexPanel {...props} />);

    fireEvent.keyDown(document, { key: "2" });
    fireEvent.keyDown(document, { key: "5" });
    fireEvent.keyDown(document, { key: "3", ctrlKey: true });
    fireEvent.keyDown(document, { key: "1" });

    expect(props.ccDispatch).toHaveBeenCalledTimes(2);
    expect(props.ccDispatch).toHaveBeenNthCalledWith(1, { type: "cycle_color", lv: 2, dir: 1 });
    expect(props.ccDispatch).toHaveBeenNthCalledWith(2, { type: "cycle_color", lv: 5, dir: 1 });
  });

  it("routes pattern-count click and keyboard activation when a gallery link is provided", () => {
    const onPatternClick = vi.fn();
    render(<HexPanel {...makeProps({ onPatternClick })} />);

    const patternLink = screen.getByRole("button", { name: "pattern_count_go_gallery(42)" });
    fireEvent.click(patternLink);
    fireEvent.keyDown(patternLink, { key: "Enter" });
    fireEvent.keyDown(patternLink, { key: " " });
    fireEvent.keyDown(patternLink, { key: "Escape" });

    expect(onPatternClick).toHaveBeenCalledTimes(3);
  });

  it("renders unlock-all only when a level is locked", () => {
    const handleUnlockAll = vi.fn();
    const { rerender } = render(
      <HexPanel {...makeProps({ locked: [false, true, false, false, false, false, false, false], handleUnlockAll })} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "btn_unlock_all" }));
    expect(handleUnlockAll).toHaveBeenCalledTimes(1);

    rerender(<HexPanel {...makeProps({ locked: new Array(8).fill(false), handleUnlockAll })} />);
    expect(screen.queryByRole("button", { name: "btn_unlock_all" })).toBeNull();
  });

  it("does not expose the pattern-count row as a button without a gallery callback", () => {
    render(<HexPanel {...makeProps()} />);

    expect(screen.queryByRole("button", { name: "pattern_count_go_gallery(42)" })).toBeNull();
  });

  it("reports hex candidate details for the hovered preview pixel", () => {
    const props = makeProps({
      hist: [1, 0, 0, 1, 1, 0, 0, 1],
      patternInfo: { total: 3, expanded: "1 x 3", perLevel: [1, 1, 1, 3, 3, 1, 1, 1] },
      locked: [false, false, false, true, false, false, false, false],
    });
    render(<HexPanel {...props} />);

    const canvas = screen.getByRole("img", { name: "label_diagram" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 128,
      bottom: 96,
      width: 128,
      height: 96,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(canvas, { clientX: 96, clientY: 24 });

    const status = screen.getByText("(1,0) Hex L3 c3/3 @300° used=1px factor×3 locked");
    expect(status).toBeTruthy();
    expect(status.getAttribute("title")).toBe("(1,0) Hex L3 c3/3 @300° used=1px factor×3 locked");

    fireEvent.pointerLeave(canvas);
    expect(screen.queryByText("(1,0) Hex L3 c3/3 @300° used=1px factor×3 locked")).toBeNull();
  });
});
