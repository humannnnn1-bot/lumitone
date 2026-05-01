// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "../App";
import { LanguageProvider } from "../i18n";

vi.mock("../utils/idb-persistence", () => ({
  loadState: vi.fn(() => Promise.resolve(null)),
  saveState: vi.fn(() => Promise.resolve()),
}));

function renderApp() {
  localStorage.setItem("chromalum_lang", "en");
  return render(
    <LanguageProvider>
      <App />
    </LanguageProvider>,
  );
}

describe("App", () => {
  it("renders primary tabs and switches from Source to Theory", async () => {
    renderApp();

    expect(await screen.findByRole("tab", { name: "Source" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Gallery" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Music" })).toBeTruthy();
    expect(screen.getByRole("application", { name: "Drawing canvas (grayscale)" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Theory" }));

    expect(await screen.findByRole("heading", { name: "Discrete Algebraic Color Theory" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Binary Levels" })).toBeTruthy();
    expect(window.location.hash).toBe("#theory");
  });

  it("opens Theory directly from the URL hash", async () => {
    window.history.replaceState(null, "", "/#theory");

    renderApp();

    expect(await screen.findByRole("heading", { name: "Discrete Algebraic Color Theory" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Theory" }).getAttribute("aria-selected")).toBe("true");
  });

  it("updates the document title and names tab panels from their tabs", async () => {
    renderApp();

    expect(await screen.findByRole("tabpanel", { name: "Source" })).toBeTruthy();
    expect(document.title).toBe("CHROMALUM - Source");

    fireEvent.click(screen.getByRole("tab", { name: "Theory" }));

    expect(await screen.findByRole("tabpanel", { name: "Theory" })).toBeTruthy();
    expect(document.title).toBe("CHROMALUM - Theory");
  });
});
