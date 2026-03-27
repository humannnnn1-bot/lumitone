/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/lumitone/",
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
      exclude: ["src/__tests__/**", "src/main.tsx"],
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        lines: 40,
        functions: 35,
        branches: 32,
        statements: 40,
      },
    },
  },
});
