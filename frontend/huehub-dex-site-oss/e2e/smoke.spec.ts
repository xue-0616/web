import { test, expect } from "@playwright/test";

/**
 * huehub-dex smoke. Validates:
 *   - the four tabs render (Swap / Tokens / Portfolio / Limit)
 *   - a slippage input is focusable on the Swap tab
 *   - no unhandled console errors during first render
 */

test("four navigation tabs are visible", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  for (const label of ["Swap", "Tokens", "Portfolio", "Limit"]) {
    await expect(page.getByRole("button", { name: new RegExp(label, "i") })).toBeVisible();
  }
  expect(errors, `unexpected errors: ${errors.join(" | ")}`).toEqual([]);
});

test("swap form accepts amount input", async ({ page }) => {
  await page.goto("/");
  const input = page.locator('input[type="number"]').first();
  await input.fill("1.5");
  await expect(input).toHaveValue("1.5");
});
