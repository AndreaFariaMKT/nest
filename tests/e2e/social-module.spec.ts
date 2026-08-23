import { expect, test, type Page } from "@playwright/test";

/**
 * Social media module smoke.
 *
 * Assumes the local Supabase stack with the seeded dev owner, like the rest of
 * this suite. Anything that needs a client in the database skips when there is
 * none, rather than failing on an empty seed.
 */

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);
}

/** True when the tenant has at least one client with the module switched on. */
async function hasSocialClient(page: Page): Promise<boolean> {
  await page.goto("/en/social/backlog");
  const select = page.locator("select").first();
  await select.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  const options = await select.locator("option").count();
  // One option is always "All clients".
  return options > 1;
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("every module screen the owner has renders", async ({ page }) => {
  await page.goto("/en/social");

  const nav = page.getByTestId("social-nav");
  await expect(nav).toBeVisible();

  // The owner holds direction + coordinate + publish, so every screen is theirs.
  const hrefs = await nav
    .locator("a")
    .evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""),
    );
  expect(hrefs.length).toBeGreaterThanOrEqual(9);

  for (const href of hrefs) {
    await page.goto(href);
    // Each screen has exactly one h1 and it is not empty.
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible();
    expect((await heading.textContent())?.trim().length).toBeGreaterThan(0);
    // A screen that threw would render Next's error boundary instead.
    await expect(page.getByTestId("social-nav")).toBeVisible();
  }
});

test("the backlog shows the shelf measured in fortnights", async ({ page }) => {
  await page.goto("/en/social/backlog");
  const stock = page.getByTestId("social-stock");
  await expect(stock).toBeVisible();
  // The meter always states a count and a per-fortnight rate.
  await expect(stock).toContainText(/themes available/i);
});

test("a theme without a reason is refused, with a sentence", async ({
  page,
}) => {
  test.skip(!(await hasSocialClient(page)), "no social client in DB");

  await page.goto("/en/social/backlog");
  await page.getByText(/add a theme/i).click();

  const form = page.getByTestId("disclosure-form");
  await expect(form).toBeVisible();

  await form.locator("#theme-title").fill("A theme with no reason behind it");
  await form.getByRole("button", { name: /add to backlog/i }).click();

  // "Why this, now" is the field that survives all the way to the client, so
  // the module refuses without it — and says so rather than failing silently.
  await expect(form).toContainText(/why this, now/i);
});

test("a theme reaches the shelf and can be pulled into the fortnight", async ({
  page,
}) => {
  test.skip(!(await hasSocialClient(page)), "no social client in DB");

  const title = `E2E theme ${Date.now()}`;

  await page.goto("/en/social/backlog");
  await page.getByText(/add a theme/i).click();
  const form = page.getByTestId("disclosure-form");
  await form.locator("#theme-title").fill(title);
  await form
    .locator("#theme-why")
    .fill("Because the smoke test needs a reason too.");
  await form.getByRole("button", { name: /add to backlog/i }).click();

  // It lands on the shelf.
  const link = page.getByRole("link", { name: title });
  await expect(link).toBeVisible({ timeout: 15_000 });

  // The piece record offers exactly one move from the shelf: pull it in.
  await link.click();
  await expect(page.locator("h1")).toContainText(title);

  const moves = page.getByTestId("piece-moves");
  await expect(moves).toBeVisible();
  await expect(
    moves.getByRole("button", { name: /pull into the fortnight/i }),
  ).toBeVisible();

  await moves.getByRole("button", { name: /pull into the fortnight/i }).click();

  // Pulled pieces are in writing, and the next move is sending the text up —
  // which the module withholds until there IS text.
  await expect(page.getByText(/writing/i).first()).toBeVisible({
    timeout: 15_000,
  });
});

// Route guarding for the module is covered where it is decided, in
// tests/unit/guard.test.ts — driving a browser through a redirect would test
// Next's middleware, not our rule.
