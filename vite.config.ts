/// <reference types="vitest" />
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { defineConfig, type Plugin, type ResolvedConfig } from "vite";
import react from "@vitejs/plugin-react";

const reactVendorPackages = ["/node_modules/react/", "/node_modules/react-dom/"];
const serviceWorkerFileName = "sw.js";

function toPrecacheUrl(filePath: string): string {
  return `./${filePath.split(sep).join("/")}`;
}

async function collectDistFiles(dir: string, root = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = join(dir, entry.name);
      if (entry.isDirectory()) return collectDistFiles(absolutePath, root);
      if (entry.name === serviceWorkerFileName) return [];
      return [relative(root, absolutePath)];
    }),
  );
  return files.flat().sort();
}

function generateServiceWorker(precacheUrls: string[], cacheVersion: string): string {
  return `const CACHE_PREFIX = "chromalum";
const PRECACHE_CACHE = \`\${CACHE_PREFIX}-precache-${cacheVersion}\`;
const RUNTIME_CACHE = \`\${CACHE_PREFIX}-runtime-${cacheVersion}\`;
const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)};
const PRECACHE_SET = new Set(PRECACHE_URLS.map((path) => new URL(path, self.registration.scope).href));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS.map((path) => new Request(path, { cache: "reload" }))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX + "-") && key !== PRECACHE_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put("./", response.clone());
    }
    return response;
  } catch {
    return (await caches.match("./")) || (await caches.match("./index.html")) || Response.error();
  }
}

async function cacheFirst(request) {
  const requestUrl = new URL(request.url);
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && (PRECACHE_SET.has(requestUrl.href) || requestUrl.pathname.startsWith(new URL("./assets/", self.registration.scope).pathname))) {
    const cache = await caches.open(PRECACHE_SET.has(requestUrl.href) ? PRECACHE_CACHE : RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}
`;
}

function chromalumServiceWorker(): Plugin {
  let resolvedConfig: ResolvedConfig;
  return {
    name: "chromalum-service-worker",
    apply: "build",
    configResolved(config) {
      resolvedConfig = config;
    },
    async closeBundle() {
      const outDir = resolvedConfig.build.outDir;
      const distFiles = await collectDistFiles(outDir);
      const contentHash = createHash("sha256");
      const precacheUrls = ["./", ...distFiles.map(toPrecacheUrl)];

      for (const file of distFiles) {
        contentHash.update(file);
        contentHash.update(await readFile(join(outDir, file)));
      }

      const cacheVersion = contentHash.digest("hex").slice(0, 12);
      await writeFile(join(outDir, serviceWorkerFileName), generateServiceWorker(precacheUrls, cacheVersion));
    },
  };
}

export default defineConfig({
  base: "/chromalum/",
  plugins: [react(), chromalumServiceWorker()],
  build: {
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");
          if (reactVendorPackages.some((pkg) => normalizedId.includes(pkg))) {
            return "react";
          }
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    exclude: ["e2e/**", "node_modules/**"],
    setupFiles: ["./src/__tests__/setup.ts"],
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/__tests__/**",
        "**/__benchmarks__/**",
        "**/*.d.ts",
        "src/types.ts",
        "src/i18n/types.ts",
        "src/main.tsx",
        "src/components/music/**",
        "src/components/MusicPanel.tsx",
        "src/hooks/useMusicEngine.ts",
      ],
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        lines: 65,
        functions: 55,
        branches: 50,
        statements: 65,
      },
    },
  },
});
