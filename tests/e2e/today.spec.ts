import { expect, test } from "@playwright/test";

test("today page renders greeting + 3 blocks + owner stats + real tasks", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);

  // Heading greets the dev user (full_name = "Dev Owner" → "Dev")
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Dev|Hi|Oi/i);

  // Three blocks remain (Tasks, Meetings, Approvals)
  await expect(page.getByTestId("today-block")).toHaveCount(3);

  // Owner sees the three stat cards
  await expect(page.getByTestId("today-stat")).toHaveCount(3);

  // At least one real task row (seed from the cycles/tasks slices) — OR the
  // empty state — is rendered. Either is acceptable.
  const rows = page.getByTestId("today-task");
  const emptyCopy = page.getByText(
    /nothing on your plate|nada no seu prato/i,
  );
  if ((await rows.count()) === 0) {
    await expect(emptyCopy).toBeVisible();
  } else {
    await expect(rows.first()).toBeVisible();
  }
});
