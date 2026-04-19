import { test, expect } from "@playwright/test";

/**
 * Smoke — the wallet landing page must render the onboarding gate on
 * a fresh browser (no stored keyblob). The two entry buttons
 * ("Create", "I have a seed phrase") must both be present and the
 * branding header visible.
 *
 * We clear localStorage first so this test is deterministic even when
 * a previous run left a half-finished wallet behind.
 */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { window.localStorage.clear(); } catch {}
  });
});

test("onboarding gate renders for a fresh install", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Solagram")).toBeVisible();
  await expect(page.getByRole("button", { name: /create a new wallet/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /seed phrase/i })).toBeVisible();
});

test("theme + language toggles exist in the header", async ({ page }) => {
  await page.goto("/");
  // Header controls row; assert at least one toggle is interactable.
  const controls = page.locator(".controls button");
  await expect(controls.first()).toBeVisible();
});
