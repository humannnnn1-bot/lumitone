// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HexDiag } from "../components/HexDiag";

vi.mock("../i18n", () => ({
  useTranslation: () => ({
    t: (key: string, ...args: unknown[]) => `${key}(${args.join(",")})`,
  }),
}));

function makeProps(overrides?: Partial<Parameters<typeof HexDiag>[0]>) {
  return {
    cc: [0, 0, 0, 0, 0, 0, 0, 0],
    dispatch: vi.fn(),
    hist: [100, 50, 30, 20, 10, 5, 3, 1],
    total: 219,
    locked: [false, false, false, false, false, false, false, false],
    onToggleLock: vi.fn(),
    ...overrides,
  };
}

describe("HexDiag", () => {
  it("renders an SVG element", () => {
    const { container } = render(<HexDiag {...makeProps()} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("role")).toBe("img");
  });

  it("has interactive groups with role='button'", () => {
    render(<HexDiag {...makeProps()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("has aria-pressed attributes on interactive groups", () => {
    render(<HexDiag {...makeProps()} />);
    const buttons = screen.getAllByRole("button");
    const withAriaPressed = buttons.filter(
      (b) => b.getAttribute("aria-pressed") !== null,
    );
    expect(withAriaPressed.length).toBe(buttons.length);
  });

  it("keyboard Enter triggers onClick (dispatch)", () => {
    const dispatch = vi.fn();
    render(<HexDiag {...makeProps({ dispatch })} />);
    const buttons = screen.getAllByRole("button");
    // Press Enter on the first button
    fireEvent.keyDown(buttons[0], { key: "Enter" });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "set_color" }),
    );
  });
});
