import { expect, test } from "@playwright/test";

/**
 * Smoke: owner creates a service, then attaches it to a new client.
 */
test("owner creates a service and attaches it to a client", async ({
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

  const stamp = Date.now();
  const serviceName = `Smoke Service ${stamp}`;

  // Create service
  await page.goto("/en/services/new");
  await page.locator("#name").fill(serviceName);
  await page.locator("#default_monthly").fill("4500,00");
  await page
    .getByRole("button", { name: /create service|criar serviço/i })
    .click();
  await expect(page).toHaveURL(/\/services$/);
  await expect(page.getByText(serviceName)).toBeVisible();

  // Create a client + attach the service
  await page.goto("/en/clients/new");
  await page.locator("#name").fill(`Services Smoke ${stamp}`);
  await page
    .getByRole("button", { name: /create client|criar cliente/i })
    .click();
  await expect(page).toHaveURL(/\/clients\/services-smoke-\d+$/);

  // Attach the service via the dropdown on the client detail
  const select = page.locator('[data-testid="attach-service-form"] select');
  await select.selectOption({ label: serviceName });
  await page
    .locator('[data-testid="attach-service-form"] button[type=submit]')
    .click();

  // Active assignment row appears with the service name
  await expect(page.locator('[data-testid="client-service-row"]').filter({
    hasText: serviceName,
  })).toBeVisible({ timeout: 5_000 });
});
