import { expect, test } from "@playwright/test";

interface AppManifestResponse {
  errors?: unknown[];
  manifest?: {
    id?: string;
  };
}

interface InstallabilityErrorsResponse {
  installabilityErrors?: unknown[];
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("chromalum_lang", "en");
  });
});

test("pre-caches the production app shell and works offline", async ({ page, context }) => {
  const response = await page.goto("/", { waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBe("/chromalum/manifest.webmanifest");

  const manifestUrl = new URL(manifestHref!, page.url()).toString();
  const manifestResponse = await page.request.get(manifestUrl);
  expect(manifestResponse.status()).toBe(200);

  const manifest = (await manifestResponse.json()) as {
    id: string;
    icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
  };
  expect(manifest.id).toBe("chromalum/");

  for (const icon of manifest.icons) {
    const iconResponse = await page.request.get(new URL(icon.src, manifestUrl).toString());
    expect(iconResponse.status(), `${icon.src} should be served`).toBe(200);
    expect(iconResponse.headers()["content-type"], `${icon.src} content type`).toContain(icon.type);
  }
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: "icon-192.png", sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ src: "icon-512.png", sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ src: "icon-maskable-512.png", sizes: "512x512", purpose: "maskable" }),
    ]),
  );

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForFunction(
    async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const cacheKeys = await caches.keys();
      return registrations.length > 0 && cacheKeys.some((key) => key.startsWith("chromalum-precache-"));
    },
    null,
    { timeout: 10_000 },
  );

  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload({ waitUntil: "networkidle" });
  }

  const swInfo = await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const cacheKeys = await caches.keys();
    const precacheKey = cacheKeys.find((key) => key.startsWith("chromalum-precache-"));
    const cachedPaths = precacheKey
      ? await caches
          .open(precacheKey)
          .then((cache) => cache.keys())
          .then((requests) => requests.map((request) => new URL(request.url).pathname))
      : [];

    return {
      controlled: !!navigator.serviceWorker.controller,
      registrationScopes: registrations.map((registration) => registration.scope),
      cacheKeys,
      cachedPaths,
    };
  });

  expect(swInfo.controlled).toBe(true);
  expect(swInfo.registrationScopes).toContain("http://127.0.0.1:4174/chromalum/");
  expect(swInfo.cacheKeys.some((key) => key.startsWith("chromalum-precache-"))).toBe(true);
  expect(swInfo.cachedPaths).toEqual(
    expect.arrayContaining([
      "/chromalum/",
      "/chromalum/index.html",
      "/chromalum/manifest.webmanifest",
      "/chromalum/icon-192.png",
      "/chromalum/icon-512.png",
      "/chromalum/icon-maskable-512.png",
    ]),
  );
  expect(swInfo.cachedPaths.some((path) => /\/assets\/MusicPanel-.+\.js$/.test(path))).toBe(true);
  expect(swInfo.cachedPaths.some((path) => /\/assets\/flood-fill\.worker-.+\.js$/.test(path))).toBe(true);
  expect(swInfo.cachedPaths.some((path) => /\/assets\/pixel-analysis\.worker-.+\.js$/.test(path))).toBe(true);

  const cdp = await context.newCDPSession(page);
  const appManifest = (await cdp.send("Page.getAppManifest")) as AppManifestResponse;
  const installability = (await cdp.send("Page.getInstallabilityErrors")) as InstallabilityErrorsResponse;
  expect(appManifest.errors ?? []).toHaveLength(0);
  expect(appManifest.manifest?.id).toBe("http://127.0.0.1:4174/chromalum/");
  expect(installability.installabilityErrors ?? []).toHaveLength(0);

  await context.setOffline(true);
  const offlineReloadResponse = await page.reload({ waitUntil: "domcontentloaded", timeout: 10_000 });
  expect(offlineReloadResponse?.status()).toBe(200);

  await page.getByRole("tab", { name: "Music" }).click();
  await expect(page.getByText("CHROMATIC MUSIC")).toBeVisible();
});
