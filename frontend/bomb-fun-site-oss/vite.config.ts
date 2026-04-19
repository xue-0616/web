import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // vitest picks up this `test` block; Playwright specs live under
  // `e2e/` and must not be collected here.
  test: {
    exclude: ["node_modules", "dist", "e2e/**", "**/*.spec.ts"],
  },
} as never);
