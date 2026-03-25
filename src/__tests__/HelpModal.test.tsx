// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { HelpModal } from "../components/HelpModal";

// Mock the i18n hook
vi.mock("../i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        help_title: "Keyboard Shortcuts",
        help_close: "Close",
        help_brush: "Brush",
        help_eraser: "Eraser",
        help_fill: "Fill",
        help_line: "Line",
        help_rect: "Rect",
        help_ellipse: "Ellipse",
        help_level: "Select luminance level",
        help_brush_size: "Brush size +/-",
        help_pan: "Pan",
        help_zoom: "Zoom",
        help_new_canvas: "New canvas",
        help_undo: "Undo",
        help_redo: "Redo",
        help_paste: "Paste image",
        help_this_help: "This help (also F1)",
        help_pan_key: "Space+Drag",
        help_zoom_key: "Wheel / +/-",
        help_save: "Save color PNG",
        help_save_key: "Ctrl+S",
        help_save_as: "Save with custom filename",
        help_save_as_key: "Ctrl+Shift+S",
        help_eyedropper: "Pick level (eyedropper)",
        help_eyedropper_key: "Right-click / Alt+click",
        help_dblclick_level: "Select level + Brush tool",
        help_dblclick_level_key: "Double-click level",
        help_zoom_pixel: "Pixel-perfect zoom",
        help_zoom_pixel_key: "Right-click zoom btn",
      };
      return map[key] ?? key;
    },
  }),
}));

// Mock the focus trap hook
vi.mock("../hooks/useFocusTrap", () => ({
  useFocusTrap: () => {},
}));

describe("HelpModal", () => {
  const helpRef = React.createRef<HTMLDivElement>();

  it("does not render when showHelp is false", () => {
    const { container } = render(
      <HelpModal showHelp={false} setShowHelp={() => {}} helpRef={helpRef} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders when showHelp is true", () => {
    render(
      <HelpModal showHelp={true} setShowHelp={() => {}} helpRef={helpRef} />,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("shows help title", () => {
    render(
      <HelpModal showHelp={true} setShowHelp={() => {}} helpRef={helpRef} />,
    );
    expect(screen.getByText("Keyboard Shortcuts")).toBeTruthy();
  });

  it("has close button", () => {
    const setShowHelp = vi.fn();
    render(
      <HelpModal showHelp={true} setShowHelp={setShowHelp} helpRef={helpRef} />,
    );
    const closeBtns = screen.getAllByText("Close");
    const closeBtn = closeBtns.find((el) => el.tagName === "BUTTON")!;
    expect(closeBtn).toBeTruthy();
    expect(closeBtn.tagName).toBe("BUTTON");
    fireEvent.click(closeBtn);
    expect(setShowHelp).toHaveBeenCalledWith(false);
  });
});
