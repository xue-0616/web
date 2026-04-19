import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

/**
 * Shared Playwright config factory used by every Phase 6/7 front-end.
 *
 * Each project ships its own `playwright.config.ts` that calls
 * `basePlaywrightConfig({ port, command })`. Keeping the shared logic
 * here means tweaks (CI reporter tweaks, browser matrix, timeouts) flow
 * to all projects in one edit.
 *
 * NOTE: this file is copied/symlinked into each project the same way
 * `sentry.ts` is — see `frontend/_shared/README.md`.
 */
export interface BaseOptions {
  /** Port the dev server binds to. Vite defaults to 5173; Next to 3000. */
  port: number;
  /** Command that boots the dev server from the project root. */
  command?: string;
  /** Test file glob, relative to each project. Defaults to `./e2e`. */
  testDir?: string;
}

export function basePlaywrightConfig(opts: BaseOptions): PlaywrightTestConfig {
  const port = opts.port;
  const command = opts.command ?? "npm run dev";
  const baseURL = `http://127.0.0.1:${port}`;
  const isCI = !!process.env.CI;

  return defineConfig({
    testDir: opts.testDir ?? "./e2e",
    timeout: 30_000,
    expect: { timeout: 5_000 },
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 1 : 0,
    workers: isCI ? 1 : undefined,
    reporter: isCI ? [["github"], ["list"]] : [["list"]],
    use: {
      baseURL,
      trace: "retain-on-failure",
      screenshot: "only-on-failure",
      video: "retain-on-failure",
    },
    projects: [
      { name: "chromium", use: { ...devices["Desktop Chrome"] } },
      // Mobile runs are opt-in so CI stays cheap; uncomment per-project
      // if that project is primarily mobile.
      // { name: "mobile", use: { ...devices["Pixel 7"] } },
    ],
    webServer: {
      command,
      port,
      reuseExistingServer: !isCI,
      timeout: 90_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  });
}
