import { test, expect } from "@playwright/test";

/**
 * bomb-fun smoke. Validates the Explore → Trade flow:
 *   1. Landing page shows the token grid
 *   2. Clicking a token opens the TradePanel
 *   3. The honeypot risk banner renders for the known-bad "Rug Boy"
 *      mock token, and the Confirm buy button is disabled.
 */

test("token grid renders on landing", async ({ page }) => {
  await page.goto("/");
  // Each mock token has an emoji + name in its card.
  await expect(page.getByText(/Bomb Kitten|Rug Boy|Chad Coin/)).toBeVisible();
});

test("opening Rug Boy surfaces the honeypot banner and blocks buy", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Rug Boy").first().click();
  // TradePanel has a "Confirm buy" or "Buy blocked" CTA depending on verdict.
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: /buy blocked/i })).toBeDisabled();
});
