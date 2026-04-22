import { expect, test } from "@playwright/test";

/**
 * Smoke: edit a pre-existing draft title (seeded by the generate-carousels
 * manual run earlier). Asserts the edit page renders and persists.
 *
 * Skipped if no drafts exist in the DB (which is fine for a cold run).
 */
test("owner edits a draft title and it persists", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);

  await page.goto("/en/content-engine");
  const viewLinks = page.getByRole("link", { name: /view drafts|ver drafts/i });
  const viewCount = await viewLinks.count();
  test.skip(viewCount === 0, "no transcripts with drafts to edit");

  await viewLinks.first().click();
  const editLink = page.getByTestId("edit-draft").first();
  test.skip(
    (await editLink.count()) === 0,
    "transcript has no generated drafts yet",
  );
  await editLink.click();

  await expect(page).toHaveURL(/\/drafts\/[0-9a-f-]+\/edit$/);

  const stamp = Date.now();
  const newTitle = `Smoke edit ${stamp}`;
  await page.locator("#title").fill(newTitle);
  await page
    .getByRole("button", { name: /save draft|salvar draft/i })
    .click();

  // Redirects back to the transcript detail; new title should be visible
  await expect(page).toHaveURL(/\/content-engine\/transcripts\/[0-9a-f-]+$/);
  await expect(page.getByText(newTitle)).toBeVisible();
});
