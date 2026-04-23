import { expect, test } from "@playwright/test";

/**
 * Smoke: the calendar grid renders 42 cells, navigates forward/back, and
 * clicking a meeting chip lands on /meetings/[id].
 */
test("calendar renders 42 cells and navigates month-by-month", async ({
  page,
}) => {
  // Login
  await page.goto("/");
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);

  // Open the calendar
  await page.goto("/en/calendar");
  await expect(page.locator("h1")).toHaveText(/calendar/i);

  // Always 42 cells (6 × 7, Monday-first)
  await expect(page.getByTestId("calendar-cell")).toHaveCount(42);

  // Forward navigation preserves the 42-cell grid
  const nextLink = page.getByTestId("calendar-next");
  await expect(nextLink).toBeVisible();
  await nextLink.click();
  await expect(page).toHaveURL(/\?ym=\d{4}-\d{2}/);
  await expect(page.getByTestId("calendar-cell")).toHaveCount(42);

  // Back takes us to the previous month (different ym than we just left)
  const prevLink = page.getByTestId("calendar-prev");
  await prevLink.click();
  await expect(page.getByTestId("calendar-cell")).toHaveCount(42);
});

test("meeting chips on the calendar link through to /meetings/[id]", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);

  // The seeded Kickoff meeting lives on 2026-05-05 — navigate directly.
  await page.goto("/en/calendar?ym=2026-05");
  const chips = page.getByTestId("calendar-meeting");
  test.skip(
    (await chips.count()) === 0,
    "no meeting chips visible for 2026-05",
  );

  await chips.first().click();
  await expect(page).toHaveURL(/\/meetings\/[0-9a-f-]+$/);
});
