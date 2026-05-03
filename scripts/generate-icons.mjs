import { chromium } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const faviconPath = resolve(rootDir, "public/favicon.svg");
const appleTouchIconPath = resolve(rootDir, "public/apple-touch-icon.png");
const iconSize = 180;

const faviconSvg = readFileSync(faviconPath, "utf8");

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: iconSize, height: iconSize },
    deviceScaleFactor: 1,
  });

  await page.setContent(`<!doctype html>
    <style>
      html,
      body {
        margin: 0;
        width: ${iconSize}px;
        height: ${iconSize}px;
        overflow: hidden;
        background: #0a0a12;
      }
      svg {
        display: block;
        width: ${iconSize}px;
        height: ${iconSize}px;
      }
    </style>
    ${faviconSvg}`);

  await page.screenshot({
    path: appleTouchIconPath,
    fullPage: false,
    omitBackground: false,
  });
} finally {
  await browser.close();
}

console.log(`Generated ${appleTouchIconPath}`);
