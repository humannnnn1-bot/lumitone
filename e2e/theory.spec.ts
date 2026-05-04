import { expect, test } from "@playwright/test";

test("opens the Theory tab and renders the main sections", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("tab", { name: "Theory" }).click();

  await expect(page.getByRole("heading", { name: /Discrete Algebraic Color Theory|離散代数的色彩理論/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Binary Levels|バイナリレベル/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Color Cube|カラーキューブ/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Hamming Code|ハミング符号/ })).toBeVisible();
});

test("opens the Theory tab directly from the URL hash", async ({ page }) => {
  await page.goto("/#theory");

  await expect(page.getByRole("tab", { name: /Theory/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: /Discrete Algebraic Color Theory|離散代数的色彩理論/ })).toBeVisible();
});

test("keeps the English Theory title on one line on narrow mobile viewports", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("chromalum_lang", "en");
  });
  await page.goto("/#theory");

  const title = page.getByRole("heading", { name: "Discrete Algebraic Color Theory" });
  await expect(title).toBeVisible();

  const metrics = await title.evaluate((node) => {
    const el = node as HTMLElement;
    const style = window.getComputedStyle(el);
    return {
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      whiteSpace: style.whiteSpace,
    };
  });

  expect(metrics.whiteSpace).toBe("nowrap");
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
});
