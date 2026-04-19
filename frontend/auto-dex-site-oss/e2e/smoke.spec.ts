import { test, expect } from "@playwright/test";

/**
 * auto-dex-site smoke. The root page must:
 *   1. render the HueHub brand + strategies tab
 *   2. let us switch between Strategies / Positions / History
 *   3. keep the wallet button visible at all times
 */

test("three-tab navigation works", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /strategies/i })).toBeVisible();
  await page.getByRole("button", { name: /positions/i }).click();
  await expect(page.getByRole("button", { name: /positions/i })).toHaveAttribute("data-on", "true");
  await page.getByRole("button", { name: /history/i }).click();
  await expect(page.getByRole("button", { name: /history/i })).toHaveAttribute("data-on", "true");
});

test("connect-wallet button is present in the header", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /connect|wallet/i }).first()).toBeVisible();
});
