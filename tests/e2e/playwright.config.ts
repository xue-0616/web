import { defineConfig } from '@playwright/test';

/**
 * Playwright config for huehub backend E2E.
 *
 * Two environment variables select the target:
 *   FARM_BASE_URL      — default http://localhost:8082
 *   RELAYER_BASE_URL   — default http://localhost:8081
 *
 * Fail-closed expectations (see tests/backend-contract.spec.ts):
 *   * FARM_PROCESSING_ENABLED=false ⇒ 503 from /intents/submit
 *   * RELAYER_CONSUMER_ENABLED=false ⇒ XADD accepted at submit,
 *     consume_once logs backlog but doesn't drain.
 *
 * These tests are idempotent and safe to run in a loop against
 * the integration-smoke compose stack.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'backend-contract',
      testMatch: /backend-contract\.spec\.ts/,
      // API-only — no browser needed.  Faster CI, fewer deps.
    },
    {
      name: 'ui-chromium',
      testMatch: /ui-.*\.spec\.ts/,
      use: {
        baseURL: process.env.UI_BASE_URL ?? 'http://localhost:3000',
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
