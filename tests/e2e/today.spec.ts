import { expect, test } from "@playwright/test";

test("today page renders greeting + 3 placeholder blocks + owner stats", async ({
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

  // Three placeholder blocks are always there
  await expect(page.getByTestId("today-block")).toHaveCount(3);

  // Owner sees the three stat cards
  await expect(page.getByTestId("today-stat")).toHaveCount(3);
});
