// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HexDiagram } from "../HexDiagram";

vi.mock("../../i18n", () => ({
  useTranslation: () => ({
    t: (key: string, ...args: unknown[]) => `${key}(${args.join(",")})`,
  }),
}));

function makeProps(overrides?: Partial<Parameters<typeof HexDiagram>[0]>) {
  return {
    colorChoiceIndices: [0, 0, 0, 0, 0, 0, 0, 0],
    dispatch: vi.fn(),
    hist: [100, 50, 30, 20, 10, 5, 3, 1],
    total: 219,
    locked: [false, false, false, false, false, false, false, false],
    onToggleLock: vi.fn(),
    onRandomize: vi.fn(),
    canRandomize: true,
    ...overrides,
  };
}

describe("HexDiagram", () => {
  it("renders an SVG element", () => {
    const { container } = render(<HexDiagram {...makeProps()} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("role")).toBe("group");
  });

  it("has interactive groups with role='button'", () => {
    render(<HexDiagram {...makeProps()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("has aria-pressed attributes on interactive groups", () => {
    render(<HexDiagram {...makeProps()} />);
    const buttons = screen.getAllByRole("button");
    const withAriaPressed = buttons.filter((b) => b.getAttribute("aria-pressed") !== null);
    expect(withAriaPressed.length).toBe(buttons.length);
  });

  it("suppresses the mobile tap highlight on the dice button", () => {
    render(<HexDiagram {...makeProps()} />);
    const diceButton = screen.getByRole("button", { name: "btn_random_color()" });
    expect(diceButton.classList.contains("hex-dice-button")).toBe(true);
    expect(diceButton.getAttribute("style")).toContain("touch-action: manipulation");
    expect(diceButton.getAttribute("style")).toContain("outline: none");
  });

  it("keyboard Enter triggers onClick (dispatch)", () => {
    const dispatch = vi.fn();
    render(<HexDiagram {...makeProps({ dispatch })} />);
    const buttons = screen.getAllByRole("button");
    // Press Enter on the first button
    fireEvent.keyDown(buttons[0], { key: "Enter" });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "set_color" }));
  });
});
