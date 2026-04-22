import { expect, test } from "@playwright/test";

/**
 * Smoke: upload a tiny PNG to a client's brand kit and verify it appears.
 *
 * Creates a unique client per run so the test is resilient to leftover state.
 * Prereqs: supabase local running with seed.sql applied, migration 002 applied.
 */

// 1×1 transparent PNG
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";

test("uploading a brand asset renders a thumbnail in the grid", async ({
  page,
}) => {
  // Login ------------------------------------------------------------------
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);

  // Create a unique client -------------------------------------------------
  const stamp = Date.now();
  const clientName = `Asset Smoke ${stamp}`;
  await page.goto("/en/clients/new");
  await page.locator("#name").fill(clientName);
  await page
    .getByRole("button", { name: /create client|criar cliente/i })
    .click();

  await expect(page).toHaveURL(/\/clients\/asset-smoke-\d+$/);

  // Navigate to the brand kit page -----------------------------------------
  await page.getByRole("link", { name: /configure|configurar/i }).click();
  await expect(page.getByRole("heading", { level: 1, name: /brand kit/i })).toBeVisible();

  // Upload a tiny PNG ------------------------------------------------------
  const fileInput = page.getByTestId("brand-asset-file");
  await fileInput.setInputFiles({
    name: "smoke.png",
    mimeType: "image/png",
    buffer: Buffer.from(TINY_PNG_BASE64, "base64"),
  });

  // A thumbnail card shows up --------------------------------------------
  const card = page.getByTestId("brand-asset-card").first();
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card.locator("img")).toBeVisible();
});
