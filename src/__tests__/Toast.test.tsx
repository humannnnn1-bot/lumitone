// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toast } from "../components/Toast";

describe("Toast", () => {
  it("renders null when message is empty", () => {
    const { container } = render(<Toast message="" type="info" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders message with correct text", () => {
    render(<Toast message="Saved successfully" type="success" />);
    expect(screen.getByText("Saved successfully")).toBeTruthy();
  });

  it("renders with role alert", () => {
    render(<Toast message="Something went wrong" type="error" />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });
});
