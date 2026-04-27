import { devices, expect, test, type Locator, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("chromalum_lang", "en");
  });
});

async function gotoSource(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Source" }).click();
}

async function selectLevel(page: Page, level: number, name: string) {
  await page.getByRole("button", { name: `Level ${level} ${name}` }).click();
}

async function drawAtCenter(page: Page, canvas: Locator) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

async function canvasPixel(canvas: Locator, x: number, y: number) {
  return canvas.evaluate(
    (node, pos) => {
      const c = node as HTMLCanvasElement;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("2d context unavailable");
      return Array.from(ctx.getImageData(pos.x, pos.y, 1, 1).data);
    },
    { x, y },
  );
}

test("draws, undoes, redoes, saves, and restores the source canvas", async ({ page }) => {
  await gotoSource(page);

  const canvas = page.getByRole("application", { name: "Drawing canvas (grayscale)" });
  await expect.poll(() => canvasPixel(canvas, 160, 160)).toEqual([0, 0, 0, 255]);

  await drawAtCenter(page, canvas);
  await expect.poll(() => canvasPixel(canvas, 160, 160)).toEqual([255, 255, 255, 255]);

  await page.getByRole("button", { name: /Undo/ }).click();
  await expect.poll(() => canvasPixel(canvas, 160, 160)).toEqual([0, 0, 0, 255]);

  await page.getByRole("button", { name: /Redo/ }).click();
  await expect.poll(() => canvasPixel(canvas, 160, 160)).toEqual([255, 255, 255, 255]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Save Gray/ }).click();
  await expect((await downloadPromise).suggestedFilename()).toMatch(/^chromalum_gray_.+\.png$/);

  await page.waitForTimeout(1300);
  await page.reload();
  const restored = page.getByRole("application", { name: "Drawing canvas (grayscale)" });
  await expect.poll(() => canvasPixel(restored, 160, 160)).toEqual([255, 255, 255, 255]);
});

test("glazes a chromatic source pixel and clears the glaze layer", async ({ page }) => {
  await gotoSource(page);

  const sourceCanvas = page.getByRole("application", { name: "Drawing canvas (grayscale)" });
  await selectLevel(page, 2, "Red");
  await drawAtCenter(page, sourceCanvas);
  await expect.poll(() => canvasPixel(sourceCanvas, 160, 160)).toEqual([76, 76, 76, 255]);

  await page.getByRole("tab", { name: "Glaze" }).click();
  const glazeCanvas = page.getByRole("img", { name: "HUE GLAZE OVERLAY" });
  await drawAtCenter(page, glazeCanvas);

  await expect(page.locator("text=/\\d+px/")).toBeVisible();
  await page.getByRole("button", { name: /Clear Glaze/ }).click();
  await expect(page.locator("text=/\\d+px/")).toHaveCount(0);
});

test("regenerates gallery variants from a drawing and opens preview actions", async ({ page }) => {
  await gotoSource(page);

  await selectLevel(page, 2, "Red");
  await drawAtCenter(page, page.getByRole("application", { name: "Drawing canvas (grayscale)" }));

  await page.getByRole("tab", { name: "Gallery" }).click();
  await expect(page.getByText(/patterns$/)).toBeVisible();

  const preview = page.getByRole("button", { name: /Click to preview/ }).first();
  await expect(preview).toBeVisible();
  await preview.click();

  await expect(page.getByRole("button", { name: "Apply", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bookmark", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
});

const pixel5 = devices["Pixel 5"];

test.describe("mobile touch", () => {
  test.use({
    viewport: pixel5.viewport,
    userAgent: pixel5.userAgent,
    deviceScaleFactor: pixel5.deviceScaleFactor,
    isMobile: pixel5.isMobile,
    hasTouch: pixel5.hasTouch,
  });

  test("draws on the source canvas with a tap", async ({ page }) => {
    await gotoSource(page);

    const canvas = page.getByRole("application", { name: "Drawing canvas (grayscale)" });
    await canvas.tap();
    await expect.poll(() => canvasPixel(canvas, 160, 160)).toEqual([255, 255, 255, 255]);
  });
});
