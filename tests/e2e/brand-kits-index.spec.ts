import { expect, test } from "@playwright/test";

/**
 * Smoke: the global /brand-kits index lists kits across all clients.
 * Pre-existing kits (from earlier smokes / manual runs) are enough —
 * we just verify the page renders at least one card OR the empty state.
 */
test("/brand-kits renders the global index", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);

  await page.goto("/en/brand-kits");
  await expect(
    page.getByRole("heading", { level: 1, name: /brand kits/i }),
  ).toBeVisible();

  // Either cards OR empty-state copy must be present.
  const cards = page.getByTestId("brand-kit-card");
  const count = await cards.count();
  if (count > 0) {
    await expect(cards.first()).toBeVisible();
  } else {
    await expect(
      page.getByText(/No brand kits yet|Nenhum brand kit/i),
    ).toBeVisible();
  }
});
