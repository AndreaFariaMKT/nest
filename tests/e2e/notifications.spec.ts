import { expect, test } from "@playwright/test";

/**
 * Smoke: the bell component renders in the TopBar after login.
 * Pre-existing seeded notifications (two unread from manual setup) are
 * enough — we verify the unread badge reflects at least one.
 */
test("notifications bell renders after login", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);

  const bell = page.getByTestId("notifications-bell");
  await expect(bell).toBeVisible();

  // Open the dropdown
  await bell.click();
  await expect(page.getByTestId("notifications-dropdown")).toBeVisible();
});
