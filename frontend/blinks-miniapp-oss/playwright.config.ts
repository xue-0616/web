import { defineConfig, devices } from "@playwright/test";

/**
 * Next 14 dev server defaults to port 3000. In CI we fall back to
 * `npm start` against the pre-built app to avoid the dev-server
 * recompile storm — the same spec works against either target.
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
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.CI ? "npm run build && npm start -- -p 3000" : "npm run dev -- -p 3000",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // Next's first build can be slow
  },
});
