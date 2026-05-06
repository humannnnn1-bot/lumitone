// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toast } from "../Toast";

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

  it("splits sentence toasts at punctuation boundaries", () => {
    render(<Toast message="保存データを使えませんでした。空のキャンバスで起動しました" type="error" />);

    const first = screen.getByText("保存データを使えませんでした。");
    const second = screen.getByText("空のキャンバスで起動しました");
    expect(first.style.whiteSpace).toBe("nowrap");
    expect(second.style.whiteSpace).toBe("nowrap");
  });

  it("lets only the file name wrap for file-name toasts", () => {
    const fileName = "chromalum_map_entropy_2026-05-06_18-45-02.png";
    render(<Toast message={`画像を長押しして保存してください: ${fileName}`} type="info" />);

    expect(screen.getByText("画像を長押しして保存してください:").style.whiteSpace).toBe("nowrap");
    expect(screen.getByText(fileName).style.overflowWrap).toBe("anywhere");
  });
});
