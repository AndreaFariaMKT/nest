import { expect, test } from "@playwright/test";

test("owner pastes a transcript and it lands in /content-engine", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);

  const stamp = Date.now();
  const clientName = `Transcript Smoke ${stamp}`;

  // Create a client for this smoke
  await page.goto("/en/clients/new");
  await page.locator("#name").fill(clientName);
  await page
    .getByRole("button", { name: /create client|criar cliente/i })
    .click();
  await expect(page).toHaveURL(/\/clients\/transcript-smoke-\d+$/);

  // Upload a transcript via paste
  await page.goto("/en/content-engine/new");
  await page
    .locator("#client_id")
    .selectOption({ label: clientName });
  await page
    .locator("#content")
    .fill(
      "Andréa: Today we're discussing the Nayara quarterly brief and pivoting to a more personal tone.",
    );
  await page
    .getByRole("button", { name: /create transcript|criar transcrição/i })
    .click();

  // Land on the list with the new row visible
  await expect(page).toHaveURL(/\/content-engine$/);
  await expect(
    page.getByTestId("transcript-row").filter({ hasText: clientName }).first(),
  ).toBeVisible();
});
