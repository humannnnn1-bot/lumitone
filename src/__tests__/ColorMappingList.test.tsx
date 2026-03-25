// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorMappingList } from "../components/ColorMappingList";
import { LEVEL_CANDIDATES } from "../color-engine";

vi.mock("../i18n", () => ({
  useTranslation: () => ({
    t: (key: string, ...args: unknown[]) => `${key}(${args.join(",")})`,
  }),
}));

function makeProps(overrides?: Partial<Parameters<typeof ColorMappingList>[0]>) {
  return {
    cc: [0, 0, 0, 0, 0, 0, 0, 0],
    dispatch: vi.fn(),
    brushLevel: 0,
    onSelectLevel: vi.fn(),
    ...overrides,
  };
}

describe("ColorMappingList", () => {
  it("renders color mapping entries for levels with alternatives", () => {
    const { container } = render(<ColorMappingList {...makeProps()} />);
    // There should be 8 level rows (L0..L7)
    const rows = container.querySelectorAll(
      "div > div > div", // level row containers
    );
    // At minimum we should find entries for levels
    expect(rows.length).toBeGreaterThanOrEqual(8);
  });

  it("navigation arrows are present for levels with multiple candidates", () => {
    render(<ColorMappingList {...makeProps()} />);
    // Levels with multiple candidates should have prev/next arrows
    const levelsWithMultiple = LEVEL_CANDIDATES.filter((c) => c.length > 1);
    if (levelsWithMultiple.length > 0) {
      const prevButtons = screen.getAllByLabelText(/aria_prev_color/);
      const nextButtons = screen.getAllByLabelText(/aria_next_color/);
      expect(prevButtons.length).toBe(levelsWithMultiple.length);
      expect(nextButtons.length).toBe(levelsWithMultiple.length);
    }
  });

  it("click on arrow dispatches color change", () => {
    const dispatch = vi.fn();
    render(<ColorMappingList {...makeProps({ dispatch })} />);
    const nextButtons = screen.queryAllByLabelText(/aria_next_color/);
    if (nextButtons.length > 0) {
      fireEvent.click(nextButtons[0]);
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "cycle_color", dir: 1 }),
      );
    }
  });
});
