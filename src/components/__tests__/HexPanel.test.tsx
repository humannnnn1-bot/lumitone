// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CC } from "../../color-engine";
import { HexPanel } from "../HexPanel";

vi.mock("../../i18n", () => ({
  useTranslation: () => ({
    t: (key: string, ...args: unknown[]) => (args.length ? `${key}(${args.join(",")})` : key),
  }),
}));

const t = ((key: string, ...args: unknown[]) => (args.length ? `${key}(${args.join(",")})` : key)) as React.ComponentProps<
  typeof HexPanel
>["t"];

function makeProps(overrides?: Partial<React.ComponentProps<typeof HexPanel>>): React.ComponentProps<typeof HexPanel> {
  return {
    hexPrvRef: React.createRef<HTMLCanvasElement>(),
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
});
