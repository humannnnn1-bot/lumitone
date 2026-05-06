import { expect, test, type Locator, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("chromalum_lang", "en");
  });
});

async function openTab(page: Page, tabName: string) {
  await page.goto("/");
  const tab = page.getByRole("tab", { name: tabName });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

async function drawAtCenter(page: Page, canvas: Locator) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

async function stabilizeForScreenshot(page: Page) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    window.scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.waitForTimeout(150);
}

test("source tab desktop layout stays stable", async ({ page }) => {
  await openTab(page, "Source");
  await expect(page.getByRole("application", { name: "Drawing canvas (grayscale)" })).toBeVisible();

  await stabilizeForScreenshot(page);
  await expect(page).toHaveScreenshot("source-desktop.png");
});

test("gallery tab with generated patterns stays stable", async ({ page }) => {
  await openTab(page, "Source");

  await page.getByRole("button", { name: "Level 2 Red" }).click();
  await drawAtCenter(page, page.getByRole("application", { name: "Drawing canvas (grayscale)" }));

  await page.getByRole("tab", { name: "Gallery" }).click();
  await expect(page.getByText(/patterns$/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Click to preview/ }).first()).toBeVisible();

  await stabilizeForScreenshot(page);
  await expect(page).toHaveScreenshot("gallery-desktop.png");
});

test("theory tab desktop layout stays stable", async ({ page }) => {
  await openTab(page, "Theory");
  await expect(page.getByRole("heading", { name: "Discrete Algebraic Color Theory" })).toBeVisible();

  await stabilizeForScreenshot(page);
  await expect(page).toHaveScreenshot("theory-desktop.png");
});

test("music tab desktop layout stays stable", async ({ page }) => {
  await openTab(page, "Music");
  await expect(page.getByText("CHROMATIC MUSIC")).toBeVisible();

  await stabilizeForScreenshot(page);
  await expect(page).toHaveScreenshot("music-desktop.png");
});

test.describe("mobile viewport", () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test("theory tab mobile layout stays stable", async ({ page }) => {
    await openTab(page, "Theory");
    await expect(page.getByRole("heading", { name: "Discrete Algebraic Color Theory" })).toBeVisible();

    await stabilizeForScreenshot(page);
    await expect(page).toHaveScreenshot("theory-mobile.png");
  });
});
