import { expect, test } from "@playwright/test";

/**
 * Smoke: the dev owner (seeded in supabase/seed.sql) can sign in and
 * land on /today. This is the "is everything wired up" check — if
 * this fails, the middleware + Supabase session pipeline is broken.
 *
 * Prereqs:
 *   - `npx supabase start` is running (port 54322)
 *   - `supabase/seed.sql` has been applied via `supabase db reset`
 */
test("dev owner can sign in and reach /today", async ({ page }) => {
  // Root redirects through i18n middleware then to /login for unauthed users.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();

  await expect(page).toHaveURL(/\/today$/);
  // Today page now greets the user by first name (see app/(app)/today).
  await expect(
    page.getByRole("heading", { level: 1, name: /hi|oi|today|hoje/i }),
  ).toBeVisible();
});
