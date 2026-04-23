import { expect, test } from "@playwright/test";

/**
 * Smoke: owner generates a client portal token on /clients/[slug] → the
 * /p/[token] URL resolves anonymously and renders the three sections
 * (upcoming / pending / published).
 *
 * Skipped when the DB has zero clients.
 */
test("owner generates portal link, anonymous visitor lands on /p/[token]", async ({
  page,
  context,
}) => {
  // 1. Owner login
  await page.goto("/");
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);

  // 2. Open first client detail page
  await page.goto("/en/clients");
  const clientLinks = page.locator('a[href*="/clients/"][href*="/"]').filter({
    hasNot: page.locator("text=/new|novo/i"),
  });
  await clientLinks
    .first()
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => {});
  const hrefs = await clientLinks.evaluateAll((els) =>
    els
      .map((e) => (e as HTMLAnchorElement).getAttribute("href"))
      .filter((h): h is string => !!h && /\/clients\/[a-z0-9-]+$/.test(h)),
  );
  test.skip(hrefs.length === 0, "no clients in DB");
  await page.goto(hrefs[0]);

  // 3. Generate (or re-use) portal token
  const existingRotate = page.getByTestId("portal-rotate");
  let generated = false;
  if ((await existingRotate.count()) === 0) {
    // No token yet — mint one.
    const generate = page.getByTestId("portal-generate");
    await generate.waitFor({ state: "visible", timeout: 10_000 });
    await generate.click();
    generated = true;
  }

  // 4. Extract portal URL from the rendered card
  const code = await page
    .locator('[data-testid=portal-card] code')
    .first()
    .textContent();
  expect(code).toBeTruthy();
  const urlMatch = code!.match(/\/p\/[a-f0-9]{64}/i);
  expect(urlMatch).not.toBeNull();
  const portalPath = urlMatch![0];

  // 5. Open in an anonymous context (no session cookies)
  const anonContext = await context.browser()!.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(`${portalPath}?locale=en`);

  await expect(anonPage.getByTestId("portal-upcoming")).toBeVisible();
  await expect(anonPage.getByTestId("portal-pending")).toBeVisible();
  await expect(anonPage.getByTestId("portal-published")).toBeVisible();

  // The page must render the client name (whatever we picked as the first
  // client). We just assert it's non-empty.
  const h1 = await anonPage.locator("h1").first().textContent();
  expect(h1?.trim().length).toBeGreaterThan(0);

  await anonContext.close();

  // 6. If we generated a token fresh for this test, revoke it afterwards
  //    so repeated test runs don't keep minting new tokens forever.
  if (generated) {
    const revoke = page.getByTestId("portal-revoke");
    if ((await revoke.count()) > 0) {
      await revoke.click();
    }
  }
});
