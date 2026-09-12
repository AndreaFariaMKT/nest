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

/**
 * The path that does not need a mail server.
 *
 * The studio has no SMTP configured, so Supabase's built-in sender allows a
 * couple of messages an hour and the invite above is not a reliable way to
 * give the accountant a login. This is the one that works today.
 */
test("owner creates a login directly and is shown the password once", async ({
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
  const stamp = Date.now();
  const email = `smoke-direct-${stamp}@nest.local`;

  const form = page.getByTestId("invite-form");
  await form.locator("#email").fill(email);
  await form.locator("#full_name").fill(`Smoke Direct ${stamp}`);
  await form.locator("#role").selectOption("accountant");
  await form
    .getByRole("button", { name: /create with a password|criar com senha/i })
    .click();

  const panel = page.getByTestId("created-credentials");
  await expect(panel).toContainText(email);
  // Four groups of five, dash separated — and none of the characters that
  // cannot be read over a phone.
  await expect(panel).toContainText(/[a-z2-9]{5}-[a-z2-9]{5}-[a-z2-9]{5}-[a-z2-9]{5}/);
  await expect(panel).not.toContainText(/[oil015]/);
});
