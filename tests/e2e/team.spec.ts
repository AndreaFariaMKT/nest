import { expect, test } from "@playwright/test";

test("owner invites a teammate and sees the confirmation banner", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);

  await page.goto("/en/team");
  await expect(
    page.getByRole("heading", { level: 1, name: /team|equipe/i }),
  ).toBeVisible();

  const stamp = Date.now();
  const inviteeEmail = `smoke-invite-${stamp}@nest.local`;

  // Limit the fill to the invite form to avoid colliding with any topbar inputs
  const form = page.getByTestId("invite-form");
  await form.locator("#email").fill(inviteeEmail);
  await form.locator("#full_name").fill(`Smoke Invite ${stamp}`);
  await form.getByRole("button", { name: /send invite|enviar convite/i }).click();

  await expect(page.getByTestId("invite-success")).toContainText(inviteeEmail);

  // Owner always shows up in the member list
  await expect(page.getByTestId("team-member").first()).toBeVisible();
});
