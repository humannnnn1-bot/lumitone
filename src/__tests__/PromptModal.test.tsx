// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PromptModal } from "../components/PromptModal";

// Mock the i18n hook
vi.mock("../i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        btn_ok: "OK",
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

describe("PromptModal", () => {
  it("does not render when open is false", () => {
    const { container } = render(
      <PromptModal open={false} title="Enter name" defaultValue="test" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders input when open is true", () => {
    render(
      <PromptModal open={true} title="Enter name" defaultValue="my-file" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Enter name")).toBeTruthy();
    const input = screen.getByDisplayValue("my-file");
    expect(input).toBeTruthy();
  });

  it("confirm button calls onConfirm with value", () => {
    const onConfirm = vi.fn();
    render(
      <PromptModal open={true} title="Enter name" defaultValue="my-file" onConfirm={onConfirm} onCancel={() => {}} />,
    );
    const okBtn = screen.getByText("OK");
    fireEvent.click(okBtn);
    expect(onConfirm).toHaveBeenCalledWith("my-file");
  });

  it("cancel button calls onCancel", () => {
    const onCancel = vi.fn();
    render(
      <PromptModal open={true} title="Enter name" defaultValue="test" onConfirm={() => {}} onCancel={onCancel} />,
    );
    const cancelBtn = screen.getByText("Cancel");
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();
  });
});
