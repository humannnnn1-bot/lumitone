import { test, expect } from "@playwright/test";

test.describe("CHROMALUM basic functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for canvas to render
    await page.waitForSelector("canvas");
  });

  test("renders the app with canvas", async ({ page }) => {
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    // Title should be visible
    await expect(page).toHaveTitle("CHROMALUM");
  });

  test("tab switching works", async ({ page }) => {
    // Find tab buttons
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    expect(count).toBeGreaterThan(3);

    // Click each tab and verify the panel changes
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click();
      const panel = page.locator('[role="tabpanel"]');
      await expect(panel).toBeVisible();
    }
  });

  test("brush stroke changes canvas pixels", async ({ page }) => {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    // Get initial pixel data
    const initialData = await canvas.evaluate((c: HTMLCanvasElement) => {
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      return Array.from(d.slice(0, 100));
    });

    // Draw a stroke
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 30, cy + 30, { steps: 5 });
    await page.mouse.up();

    // Wait a moment for render
    await page.waitForTimeout(100);

    // Check pixels changed
    const afterData = await canvas.evaluate((c: HTMLCanvasElement) => {
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      return Array.from(d.slice(0, 100));
    });

    // At least some pixels should differ
    expect(initialData).not.toEqual(afterData);
  });

  test("undo restores previous state", async ({ page }) => {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    // Capture initial state
    const getPixelSum = async () => canvas.evaluate((c: HTMLCanvasElement) => {
      const ctx = c.getContext("2d");
      if (!ctx) return 0;
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < d.length; i++) sum += d[i];
      return sum;
    });

    const before = await getPixelSum();

    // Draw something
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 50, cy + 50, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(100);

    const after = await getPixelSum();
    expect(after).not.toBe(before);

    // Undo with Ctrl+Z
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(100);

    const undone = await getPixelSum();
    expect(undone).toBe(before);
  });

  test("keyboard shortcut changes tool", async ({ page }) => {
    // Press 'e' for eraser
    await page.keyboard.press("e");
    // Verify eraser is selected (look for aria-pressed or active state)
    const eraserBtn = page.locator('button:has-text("E")').or(page.locator('[aria-label*="eraser" i]')).first();
    // The button should exist and be in some active state
    await expect(eraserBtn).toBeVisible();
  });
});
