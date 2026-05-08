import type React from "react";

import { getTabButtonId, getTabPanelId, MAIN_TABS } from "../tabs";
import type { MainTabId } from "../tabs";
import type { TranslationFn } from "../i18n";
import { S_TAB_ACTIVE, S_TAB_INACTIVE } from "../styles/shared";

const S_TABLIST: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 0,
  marginBottom: "var(--sp-tablist-mb)",
  width: "100%",
};

interface AppTabBarProps {
  activeTabId: MainTabId;
  onTabChange: (tabId: MainTabId) => void;
  t: TranslationFn;
}

export function AppTabBar({ activeTabId, onTabChange, t }: AppTabBarProps) {
  return (
    <div role="tablist" aria-label={t("tablist_label")} style={S_TABLIST}>
      {MAIN_TABS.map(({ id, key }) => (
        <button
          key={key}
          id={getTabButtonId(id)}
          role="tab"
          aria-selected={activeTabId === id}
          aria-controls={getTabPanelId(id)}
          onClick={() => onTabChange(id)}
          style={activeTabId === id ? S_TAB_ACTIVE : S_TAB_INACTIVE}
        >
          {t(key)}
        </button>
      ))}
    </div>
  );
}
