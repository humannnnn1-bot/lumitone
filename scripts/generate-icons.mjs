import { chromium } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const faviconPath = resolve(rootDir, "public/favicon.svg");
const maskableIconPath = resolve(rootDir, "public/icon-maskable.svg");
const appleTouchIconPath = resolve(rootDir, "public/apple-touch-icon.png");

const faviconSvg = readFileSync(faviconPath, "utf8");
const maskableIconSvg = readFileSync(maskableIconPath, "utf8");

const iconJobs = [
  { path: appleTouchIconPath, size: 180, svg: faviconSvg },
  { path: resolve(rootDir, "public/icon-192.png"), size: 192, svg: faviconSvg },
  { path: resolve(rootDir, "public/icon-512.png"), size: 512, svg: faviconSvg },
  { path: resolve(rootDir, "public/icon-maskable-512.png"), size: 512, svg: maskableIconSvg },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  for (const job of iconJobs) {
    await page.setViewportSize({ width: job.size, height: job.size });
    await page.setContent(`<!doctype html>
      <style>
        html,
        body {
          margin: 0;
          width: ${job.size}px;
          height: ${job.size}px;
          overflow: hidden;
          background: #0a0a12;
        }
        svg {
          display: block;
          width: ${job.size}px;
          height: ${job.size}px;
        }
      </style>
      ${job.svg}`);

    await page.screenshot({
      path: job.path,
      fullPage: false,
      omitBackground: false,
    });

    console.log(`Generated ${job.path}`);
  }
} finally {
  await browser.close();
}
