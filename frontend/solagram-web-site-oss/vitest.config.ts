import { defineConfig } from "vitest/config";

/**
 * Standalone vitest config for the Astro site — Astro's own config
 * doesn't host a `test` section, so we tell vitest directly to skip
 * Playwright specs living under `e2e/`.
 */
export default defineConfig({
  test: {
    exclude: ["node_modules", "dist", ".astro", "e2e/**", "**/*.spec.ts"],
  },
});
