// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { LanguageProvider } from "../i18n/LanguageContext";

describe("LanguageSwitcher", () => {
  it("renders the switch button", () => {
    render(
      <LanguageProvider>
        <LanguageSwitcher />
      </LanguageProvider>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeTruthy();
  });

  it("button click toggles language", () => {
    render(
      <LanguageProvider>
        <LanguageSwitcher />
      </LanguageProvider>,
    );
    const btn = screen.getByRole("button");
    const initialText = btn.textContent;
    fireEvent.click(btn);
    const newText = btn.textContent;
    expect(newText).not.toBe(initialText);
  });
});
