import { test, expect } from "@playwright/test";

/**
 * Marketing site smoke. Asserts:
 *   - homepage renders the product name
 *   - Download and Legal routes are reachable and return 2xx
 */

test("home page renders the brand", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBeLessThan(400);
  await expect(page.getByText(/Solagram/i)).toBeVisible();
});

test("download and legal pages return 2xx", async ({ page }) => {
  for (const path of ["/download", "/legal/privacy", "/legal/terms"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
  }
});
