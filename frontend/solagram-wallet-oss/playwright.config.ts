import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — smoke only. Boots `npm run dev` once, hits the
 * root URL, verifies the onboarding gate renders. See
 * `frontend/_shared/README.md` for the integration rationale.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 5173",
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
});
