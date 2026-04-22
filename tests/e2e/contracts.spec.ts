import { expect, test } from "@playwright/test";

/**
 * Smoke: owner creates a client + contract; list shows it with MRR.
 */
test("owner creates a contract and it shows up in the list", async ({
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

  // Create a fresh client
  const stamp = Date.now();
  await page.goto("/en/clients/new");
  await page.locator("#name").fill(`Contract Smoke ${stamp}`);
  await page
    .getByRole("button", { name: /create client|criar cliente/i })
    .click();
  await expect(page).toHaveURL(/\/clients\/contract-smoke-\d+$/);

  // Go to the contracts route via the owner-only manage link
  await page.getByRole("link", { name: /manage|gerenciar/i }).click();
  await expect(page.getByRole("heading", { level: 1, name: /contracts|contratos/i })).toBeVisible();

  // Create a contract
  await page.getByRole("link", { name: /new contract|novo contrato/i }).click();
  await page.locator("#title").fill("Social Media Essential");
  await page.locator("#monthly_value").fill("4500,00");
  await page.locator("#starts_on").fill("2026-01-01");
  await page
    .getByRole("button", { name: /create contract|criar contrato/i })
    .click();

  // Back on the contracts list, card should appear with R$ 4.500,00 and the title
  await expect(page).toHaveURL(/\/contracts$/);
  await expect(page.getByText("Social Media Essential")).toBeVisible();
  await expect(page.getByText(/R\$\s*4\.500,00/).first()).toBeVisible();
});
