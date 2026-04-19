import { defineConfig, devices } from "@playwright/test";

/**
 * Astro dev server defaults to port 4321. We bind to it explicitly so
 * CI doesn't race against another dev server on the same host.
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
    baseURL: "http://127.0.0.1:4321",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 4321",
    port: 4321,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
});
