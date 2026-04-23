import { expect, test } from "@playwright/test";

/**
 * Smoke: owner generates an approval link on a draft → the link resolves
 * anonymously (no session) → clicking "Approve" flips the approval row
 * and lands on the thanks state.
 *
 * Skipped when the DB has no draft with slides to approve.
 */
test("client approves via public token link", async ({ page, context }) => {
  // 1. Owner login
  await page.goto("/");
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);

  // 2. Collect every draft edit URL across every transcript — we need one
  // whose draft has slides (approval-links section only renders then).
  await page.goto("/en/content-engine");
  const transcriptLinks = page.locator(
    'a[href*="/content-engine/transcripts/"]',
  );
  await transcriptLinks
    .first()
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => {});
  const transcriptHrefs: string[] = await transcriptLinks.evaluateAll((els) =>
    els
      .map((e) => (e as HTMLAnchorElement).getAttribute("href"))
      .filter((h): h is string => !!h),
  );
  test.skip(transcriptHrefs.length === 0, "no transcripts in DB");

  const draftHrefs: string[] = [];
  for (const href of transcriptHrefs) {
    await page.goto(href);
    const editLinks = page.getByTestId("edit-draft");
    await editLinks
      .first()
      .waitFor({ state: "visible", timeout: 3_000 })
      .catch(() => {});
    const hrefs = await editLinks.evaluateAll((els) =>
      els
        .map((e) => (e as HTMLAnchorElement).getAttribute("href"))
        .filter((h): h is string => !!h),
    );
    draftHrefs.push(...hrefs);
    if (draftHrefs.length >= 3) break; // enough to find one with slides
  }
  test.skip(draftHrefs.length === 0, "no drafts generated yet");

  // 3. Walk the drafts until we find one that renders the approval panel.
  let generateLocator = page.getByTestId("generate-approval-link");
  let foundOnDraft: string | null = null;
  for (const href of draftHrefs) {
    await page.goto(href);
    const btn = page.getByTestId("generate-approval-link");
    await btn.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
    if ((await btn.count()) > 0) {
      generateLocator = btn;
      foundOnDraft = href;
      break;
    }
  }
  test.skip(!foundOnDraft, "no draft with slides to approve");

  // 4. Generate the approval link
  await generateLocator.click();
  const row = page.getByTestId("approval-link-row").first();
  await expect(row).toBeVisible();
  const urlCode = await row
    .getByTestId("approval-link-url")
    .first()
    .textContent();
  expect(urlCode).toBeTruthy();

  const urlMatch = urlCode!.match(/\/a\/[a-f0-9]{64}(?:\?locale=[a-z-]+)?/i);
  expect(urlMatch).not.toBeNull();
  const approvalPath = urlMatch![0];

  // 5. Open the approval link in an anonymous browser context
  const anonContext = await context.browser()!.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(approvalPath);

  await expect(anonPage.getByTestId("decision-block")).toBeVisible();
  await expect(anonPage.getByTestId("approve-btn")).toBeVisible();

  await anonPage
    .locator("form", { has: anonPage.getByTestId("approve-btn") })
    .locator("textarea")
    .fill("Smoke approval");
  await anonPage.getByTestId("approve-btn").click();

  // Thanks state
  await expect(anonPage).toHaveURL(/\/a\/[a-f0-9]{64}\?thanks=1/);
  await expect(anonPage.getByTestId("decision-block")).toHaveCount(0);

  await anonContext.close();
});
