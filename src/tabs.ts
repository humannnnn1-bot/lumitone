export const MAIN_TABS = [
  { id: "gallery", key: "tab_gallery", hash: "gallery" },
  { id: "hex", key: "tab_hex", hash: "hex" },
  { id: "source", key: "tab_source", hash: "source" },
  { id: "color", key: "tab_color", hash: "color" },
  { id: "glaze", key: "tab_glaze", hash: "glaze" },
  { id: "stats", key: "tab_stats", hash: "map" },
  { id: "theory", key: "tab_theory", hash: "theory" },
  { id: "music", key: "tab_music", hash: "music" },
] as const;

export type MainTab = (typeof MAIN_TABS)[number];
export type MainTabId = MainTab["id"];

export const DEFAULT_TAB_ID: MainTabId = "source";
export const STATS_TAB_ID: MainTabId = "stats";

export function tabIdFromIndex(index: number): MainTabId | null {
  return MAIN_TABS[index]?.id ?? null;
}

export function tabIndexFromId(id: MainTabId): number {
  return MAIN_TABS.findIndex((tab) => tab.id === id);
}

export function tabFromId(id: MainTabId): MainTab {
  return MAIN_TABS[tabIndexFromId(id)];
}

export function getTabButtonId(id: MainTabId): string {
  return `tab-${id}`;
}

export function getTabPanelId(id: MainTabId): string {
  return `tabpanel-${id}`;
}
