// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NewCanvasModal } from "../components/NewCanvasModal";

// Mock the i18n hook
vi.mock("../i18n", () => ({
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
vi.mock("../hooks/useFocusTrap", () => ({
  useFocusTrap: () => {},
}));

describe("NewCanvasModal", () => {
  it("does not render when open is false", () => {
    const { container } = render(
      <NewCanvasModal open={false} onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders when open is true", () => {
    render(
      <NewCanvasModal open={true} onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("shows title and create/cancel buttons", () => {
    render(
      <NewCanvasModal open={true} onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText("New Canvas")).toBeTruthy();
    expect(screen.getByText("Create")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("cancel button calls onCancel", () => {
    const onCancel = vi.fn();
    render(
      <NewCanvasModal open={true} onConfirm={() => {}} onCancel={onCancel} />,
    );
    const cancelBtn = screen.getByText("Cancel");
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();
  });
});
