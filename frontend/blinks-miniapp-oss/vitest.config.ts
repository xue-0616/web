import { defineConfig } from "vitest/config";

/**
 * Standalone vitest config — blinks is a Next.js app without a
 * `vite.config.ts`, so vitest needs its own file to know which
 * patterns to exclude. Playwright specs live under `e2e/`.
 */
export default defineConfig({
  test: {
    exclude: ["node_modules", ".next", "dist", "e2e/**", "**/*.spec.ts"],
  },
});
