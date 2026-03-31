/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/chromalum/",
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },
  test: {
    globals: true,
    exclude: ["e2e/**", "node_modules/**"],
    setupFiles: ["./src/__tests__/setup.ts"],
    environmentMatchGlobs: [
      ["**/*.test.tsx", "jsdom"],
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/__tests__/**", "src/main.tsx", "src/components/theory/**", "src/components/TheoryPanel.tsx", "src/components/music/**", "src/components/MusicPanel.tsx", "src/hooks/useMusicEngine.ts", "src/hooks/useSonification.ts"],
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        lines: 36,
        functions: 33,
        branches: 26,
        statements: 36,
      },
    },
  },
});
