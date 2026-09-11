import { expect, test } from "@playwright/test";

/**
 * The first-run path through the finance module.
 *
 * This is the walk that was impossible before: an account, a rate, a movement
 * and a receivable are the four things a person has to be able to create for
 * the rest of the module — the dashboard, the cash flow, the nota queue and
 * the bank matcher — to have anything to work from. Every one of them used to
 * be writable only by confirming a line from an imported bank file.
 */
test("the studio can set up its money from an empty module", async ({
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
  const accountName = `Smoke Account ${stamp}`;

  // 1 — an account, which is what the ledger hangs off.
  await page.goto("/en/finance/accounts");
  await page.locator("#name-new").fill(accountName);
  await page.locator("#institution-new").fill("Nubank");
  await page.getByRole("button", { name: /^add account$/i }).click();
  await expect(page.getByText(accountName).first()).toBeVisible();

  // 2 — today's rate. Without it nothing held in dollars joins a total.
  await page.locator("#fx-rate").fill("5,37");
  await page.getByRole("button", { name: /save rate/i }).click();
  await expect(page.getByText("5,3700").first()).toBeVisible();

  // 3 — a movement typed by hand.
  await page.goto("/en/finance/entries");
  await page.locator("#description").fill(`Smoke expense ${stamp}`);
  await page.locator("#amount").fill("1.350,50");
  // The option carries the currency after the name, so match on what the
  // page actually renders rather than on the name alone.
  await page
    .locator("#account_id")
    .selectOption({ label: `${accountName} · BRL` });
  await page.getByRole("button", { name: /^record$/i }).click();
  await expect(page.getByText(`Smoke expense ${stamp}`)).toBeVisible();
  // Money out is negative, and the centavos survive the comma.
  await expect(page.getByText(/-R\$\s*1\.350,50/).first()).toBeVisible();

  // 4 — a receivable, which is what the bank matcher compares against.
  await page.goto("/en/finance/due");
  await page.locator("#receivable-description").fill(`Smoke invoice ${stamp}`);
  await page.locator("#receivable-amount").fill("4.000,00");
  await page.getByRole("button", { name: /add receivable/i }).click();
  await expect(page.getByText(`Smoke invoice ${stamp}`)).toBeVisible();

  // Settling it closes the obligation AND records the money — a row that
  // closed without an entry is money that vanished on the day it arrived.
  await page
    .locator('[data-testid="receivable-row"]', {
      hasText: `Smoke invoice ${stamp}`,
    })
    .getByRole("button", { name: /^received$/i })
    .click();
  await expect(
    page
      .locator('[data-testid="receivable-row"]', {
        hasText: `Smoke invoice ${stamp}`,
      })
      .getByText(/settled/i),
  ).toBeVisible();

  await page.goto("/en/finance/entries");
  await expect(page.getByText(`Smoke invoice ${stamp}`)).toBeVisible();
});
