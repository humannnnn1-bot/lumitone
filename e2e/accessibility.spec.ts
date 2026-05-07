import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

type AxeViolation = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number];

const INTENTIONAL_COLOR_SAMPLE_ATTR = 'data-a11y-color-contrast-exception="intentional-color-sample"';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("chromalum_lang", "en");
  });
});

function formatViolations(violations: AxeViolation[]): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .slice(0, 3)
        .map((node) => `    - ${node.target.map(String).join(" ")}${node.failureSummary ? `\n      ${node.failureSummary}` : ""}`)
        .join("\n");
      const extra = violation.nodes.length > 3 ? `\n    - ...and ${violation.nodes.length - 3} more node(s)` : "";
      return `[${violation.impact ?? "unknown"}] ${violation.id}: ${violation.help}\n${targets}${extra}`;
    })
    .join("\n\n");
}

function filterIntentionalColorSampleContrast(violations: AxeViolation[]): AxeViolation[] {
  return violations
    .map((violation) => {
      if (violation.id !== "color-contrast") return violation;
      const nodes = violation.nodes.filter((node) => !node.html?.includes(INTENTIONAL_COLOR_SAMPLE_ATTR));
      return { ...violation, nodes };
    })
    .filter((violation) => violation.nodes.length > 0);
}

async function expectNoA11yViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = filterIntentionalColorSampleContrast(results.violations);
  expect(violations, `${label} accessibility violations:\n${formatViolations(violations)}`).toEqual([]);
}

async function gotoSource(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Source" }).click();
}

async function drawAtCenter(page: Page, canvas: Locator) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

test("has no detectable accessibility violations on the main tabs", async ({ page }) => {
  await page.goto("/");

  for (const tab of ["Source", "Color", "Hex", "Glaze", "Map", "Gallery", "Theory", "Music"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expectNoA11yViolations(page, `${tab} tab`);
  }
});

test("has no detectable accessibility violations in representative dialogs", async ({ page }) => {
  await gotoSource(page);

  await page.getByRole("button", { name: /New/ }).click();
  await expect(page.getByRole("dialog", { name: "New Canvas" })).toBeVisible();
  await expectNoA11yViolations(page, "New Canvas dialog");
  await page.getByRole("button", { name: "Cancel" }).click();

  const sourceCanvas = page.getByRole("application", { name: "Drawing canvas (grayscale)" });
  await page.getByRole("button", { name: "Level 2 Red" }).click();
  await drawAtCenter(page, sourceCanvas);
  await page.getByRole("tab", { name: "Gallery" }).click();
  await page
    .getByRole("button", { name: /Click to preview/ })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "Pattern preview" })).toBeVisible();
  await expectNoA11yViolations(page, "Gallery preview dialog");
});
