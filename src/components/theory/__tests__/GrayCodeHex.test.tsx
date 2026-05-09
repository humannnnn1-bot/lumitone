// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../../i18n";
import { GrayCodeHex } from "../GrayCodeHex";

function renderWithLanguage() {
  localStorage.setItem("chromalum_lang", "en");
  return render(
    <LanguageProvider>
      <GrayCodeHex hlLevel={null} onHover={vi.fn()} />
    </LanguageProvider>,
  );
}

function activeEdges(svg: HTMLElement) {
  return [...svg.querySelectorAll("line")].filter((line) => line.getAttribute("stroke-width") === "2.5");
}

describe("GrayCodeHex", () => {
  it("aligns the active edge with the counter-clockwise transition", () => {
    renderWithLanguage();

    const svg = screen.getByRole("img", { name: "Gray Code Cycle" });

    expect(activeEdges(svg)).toHaveLength(1);
    expect(activeEdges(svg)[0].getAttribute("stroke")).toBe("#00ff00");

    fireEvent.click(screen.getByRole("button", { name: "↺ Counter-clockwise" }));

    expect(screen.getByText("Toggle: B")).toBeTruthy();
    expect(screen.getByText("010 (Red) → 011 (Magenta)")).toBeTruthy();
    expect(activeEdges(svg)).toHaveLength(1);
    expect(activeEdges(svg)[0].getAttribute("stroke")).toBe("#0000ff");
  });

  it("follows clockwise adjacent node clicks without starting playback", () => {
    renderWithLanguage();

    const svg = screen.getByRole("img", { name: "Gray Code Cycle" });

    fireEvent.click(screen.getByText("110"));

    expect(screen.getByText("110 (Yellow) → 100 (Green)")).toBeTruthy();
    expect(screen.getByText("Toggle: R")).toBeTruthy();
    expect(activeEdges(svg)).toHaveLength(1);
    expect(activeEdges(svg)[0].getAttribute("stroke")).toBe("#ff0000");
    expect(screen.queryByRole("button", { name: "⏸ Pause" })).toBeNull();
  });

  it("follows counter-clockwise adjacent node clicks without starting playback", () => {
    renderWithLanguage();

    const svg = screen.getByRole("img", { name: "Gray Code Cycle" });

    fireEvent.click(screen.getByText("011"));

    expect(screen.getByText("011 (Magenta) → 001 (Blue)")).toBeTruthy();
    expect(screen.getByText("Toggle: R")).toBeTruthy();
    expect(activeEdges(svg)).toHaveLength(1);
    expect(activeEdges(svg)[0].getAttribute("stroke")).toBe("#ff0000");
    expect(screen.queryByRole("button", { name: "⏸ Pause" })).toBeNull();
  });
});
