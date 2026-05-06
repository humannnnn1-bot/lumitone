import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

interface AxeViolationSummary {
  id: string;
  impact: string | null;
  help: string;
  nodes: {
    target: string[];
    failureSummary?: string | null;
  }[];
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("chromalum_lang", "en");
  });
});

function formatViolations(violations: AxeViolationSummary[]): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .slice(0, 3)
        .map((node) => `    - ${node.target.join(" ")}${node.failureSummary ? `\n      ${node.failureSummary}` : ""}`)
        .join("\n");
      const extra = violation.nodes.length > 3 ? `\n    - ...and ${violation.nodes.length - 3} more node(s)` : "";
      return `[${violation.impact ?? "unknown"}] ${violation.id}: ${violation.help}\n${targets}${extra}`;
    })
    .join("\n\n");
}

async function expectNoA11yViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, `${label} accessibility violations:\n${formatViolations(results.violations)}`).toEqual([]);
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
