// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppTabBar } from "../AppTabBar";
import type { TranslationFn } from "../../i18n";
import { MAIN_TABS } from "../../tabs";
import { en } from "../../i18n/en";

const t: TranslationFn = (key) => en[key as keyof typeof en] ?? key;

describe("AppTabBar", () => {
  it("renders app tabs and reports tab changes", () => {
    const onTabChange = vi.fn();

    render(<AppTabBar activeTabId="source" onTabChange={onTabChange} t={t} />);

    expect(screen.getByRole("tablist", { name: en.tablist_label })).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(MAIN_TABS.length);
    expect(screen.getByRole("tab", { name: "Source" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Source" }).getAttribute("aria-controls")).toBe("tabpanel-source");

    fireEvent.click(screen.getByRole("tab", { name: "Theory" }));

    expect(onTabChange).toHaveBeenCalledWith("theory");
  });
});
