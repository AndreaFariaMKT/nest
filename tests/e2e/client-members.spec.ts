import { expect, test } from "@playwright/test";

/**
 * Smoke: owner invites a teammate, then attaches them to a fresh client
 * via the detail page Team card. The attached row shows up in the list.
 */
test("owner attaches an invited staff member to a client", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);

  const stamp = Date.now();
  const inviteeEmail = `member-smoke-${stamp}@nest.local`;
  const inviteeName = `Member ${stamp}`;

  // Invite the teammate
  await page.goto("/en/team");
  const inviteForm = page.getByTestId("invite-form");
  await inviteForm.locator("#email").fill(inviteeEmail);
  await inviteForm.locator("#full_name").fill(inviteeName);
  await inviteForm
    .getByRole("button", { name: /send invite|enviar convite/i })
    .click();
  await expect(page.getByTestId("invite-success")).toBeVisible();

  // Create a fresh client
  await page.goto("/en/clients/new");
  await page.locator("#name").fill(`Members Smoke ${stamp}`);
  await page
    .getByRole("button", { name: /create client|criar cliente/i })
    .click();
  await expect(page).toHaveURL(/\/clients\/members-smoke-\d+$/);

  // Attach the teammate via the Team card
  const attachForm = page.getByTestId("attach-member-form");
  await attachForm.locator("select").selectOption({ label: inviteeName });
  await attachForm.locator("button[type=submit]").click();

  const row = page.getByTestId("client-member-row").filter({
    hasText: inviteeName,
  });
  await expect(row).toBeVisible({ timeout: 5_000 });
});
