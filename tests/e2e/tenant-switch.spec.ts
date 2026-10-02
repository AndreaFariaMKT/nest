import { expect, test } from "@playwright/test";

/**
 * A login in both houses works in one at a time.
 *
 * The seed makes dev@nest.local a founder of AFM and of Nest — the same shape
 * as Andréa's account. Before migration 059 she always landed in AFM, with no
 * way into Nest, and the database would have shown her both houses' rows on
 * any screen that forgot to filter.
 */
test("switching house changes the theme, the rows, and where new rows land", async ({
  page,
  context,
}) => {
  // A previous run's choice would otherwise decide the starting house.
  await context.clearCookies();

  await page.goto("/");
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);

  const sidebar = page.locator("aside");
  const switcher = sidebar.getByLabel(/company|empresa/i);

  // No choice yet: the lowest tenant id, AFM.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "afm");
  await expect(switcher).toBeVisible();

  // A client in AFM.
  const name = `House Smoke ${Date.now()}`;
  await page.goto("/en/clients/new");
  await page.locator("#name").fill(name);
  await page.getByRole("button", { name: /create client|criar cliente/i }).click();
  await expect(page).toHaveURL(/\/clients\/house-smoke-\d+$/);
  const afmClientUrl = page.url();
  const slugPath = new URL(afmClientUrl).pathname;

  // Into Nest.
  await sidebar.getByLabel(/company|empresa/i).selectOption({ label: "Nest" });
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "nest");

  // AFM's client is gone from the list AND from its own URL.
  await page.goto("/en/clients");
  await expect(page.getByText(name)).toHaveCount(0);
  // By URL it renders nothing of the client. Not a 404 status: the route has a
  // loading.tsx, so the response has already started streaming as 200 by the
  // time the page calls notFound().
  await page.goto(afmClientUrl);
  await expect(page.locator("main")).not.toContainText(name);

  // The same name in Nest is a different client, with the same slug — slugs
  // are unique per house since 059.
  await page.goto("/en/clients/new");
  await page.locator("#name").fill(name);
  await page.getByRole("button", { name: /create client|criar cliente/i }).click();
  await expect(page).toHaveURL(new RegExp(`${slugPath}$`));

  // And back: AFM sees one copy of the name, its own.
  await sidebar.getByLabel(/company|empresa/i).selectOption({ label: "AFM" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "afm");
  await page.goto("/en/clients");
  await expect(page.getByText(name)).toHaveCount(1);
});
