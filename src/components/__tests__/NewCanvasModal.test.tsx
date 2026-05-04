// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NewCanvasModal } from "../NewCanvasModal";

// Mock the i18n hook
vi.mock("../../i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        new_canvas_title: "New Canvas",
        new_canvas_max: "Max",
        btn_create: "Create",
        btn_cancel: "Cancel",
      };
      return map[key] ?? key;
    },
  }),
}));

// Mock the focus trap hook
vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => {},
}));

describe("NewCanvasModal", () => {
  it("does not render when open is false", () => {
    const { container } = render(<NewCanvasModal open={false} onConfirm={() => {}} onCancel={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when open is true", () => {
    render(<NewCanvasModal open={true} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("shows title and create/cancel buttons", () => {
    render(<NewCanvasModal open={true} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("New Canvas")).toBeTruthy();
    expect(screen.getByText("Create")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("does not include 320x320 in the preset buttons", () => {
    render(<NewCanvasModal open={true} onConfirm={() => {}} onCancel={() => {}} />);

    expect(screen.queryByText("320\u00D7320")).toBeNull();
    expect(screen.getByText("256\u00D7256")).toBeTruthy();
    expect(screen.getByText("512\u00D7512")).toBeTruthy();
  });

  it("includes 2048x2048 as the largest preset", () => {
    render(<NewCanvasModal open={true} onConfirm={() => {}} onCancel={() => {}} />);

    expect(screen.getByText("2048\u00D72048")).toBeTruthy();
    expect((screen.getByLabelText("aria_canvas_width") as HTMLInputElement).max).toBe("2048");
    expect((screen.getByLabelText("aria_canvas_height") as HTMLInputElement).max).toBe("2048");
  });

  it("cancel button calls onCancel", () => {
    const onCancel = vi.fn();
    render(<NewCanvasModal open={true} onConfirm={() => {}} onCancel={onCancel} />);
    const cancelBtn = screen.getByText("Cancel");
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();
  });

  it("allows size fields to be temporarily empty while editing", () => {
    render(<NewCanvasModal open={true} onConfirm={() => {}} onCancel={() => {}} />);

    const width = screen.getByLabelText("aria_canvas_width") as HTMLInputElement;
    const height = screen.getByLabelText("aria_canvas_height") as HTMLInputElement;

    fireEvent.change(width, { target: { value: "" } });
    fireEvent.change(height, { target: { value: "" } });

    expect(width.value).toBe("");
    expect(height.value).toBe("");
  });

  it("uses retyped size values when creating after clearing inputs", () => {
    const onConfirm = vi.fn();
    render(<NewCanvasModal open={true} onConfirm={onConfirm} onCancel={() => {}} />);

    const width = screen.getByLabelText("aria_canvas_width");
    const height = screen.getByLabelText("aria_canvas_height");
    fireEvent.change(width, { target: { value: "" } });
    fireEvent.change(width, { target: { value: "48" } });
    fireEvent.change(height, { target: { value: "" } });
    fireEvent.change(height, { target: { value: "24" } });
    fireEvent.click(screen.getByText("Create"));

    expect(onConfirm).toHaveBeenCalledWith(48, 24);
  });

  it.each([
    ["1200", "630", 1200, 630],
    ["630", "1200", 630, 1200],
  ])("allows non-square canvas size %sx%s by manual input", (inputW, inputH, expectedW, expectedH) => {
    const onConfirm = vi.fn();
    render(<NewCanvasModal open={true} onConfirm={onConfirm} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText("aria_canvas_width"), { target: { value: inputW } });
    fireEvent.change(screen.getByLabelText("aria_canvas_height"), { target: { value: inputH } });
    fireEvent.click(screen.getByText("Create"));

    expect(onConfirm).toHaveBeenCalledWith(expectedW, expectedH);
  });

  it("clamps dimensions above the maximum canvas size", () => {
    const onConfirm = vi.fn();
    render(<NewCanvasModal open={true} onConfirm={onConfirm} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText("aria_canvas_width"), { target: { value: "4096" } });
    fireEvent.change(screen.getByLabelText("aria_canvas_height"), { target: { value: "4096" } });
    fireEvent.click(screen.getByText("Create"));

    expect(onConfirm).toHaveBeenCalledWith(2048, 2048);
  });
});
