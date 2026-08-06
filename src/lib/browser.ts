// Headless-browser launcher shared by the PNG (creatives) and PDF (reports)
// renderers.
//
// Prod (Vercel serverless / AWS Lambda): @sparticuz/chromium ships a Chromium
// build small enough to fit the function bundle, driven via puppeteer-core.
// Local dev: reuse the Chromium that @playwright/test already installed, so we
// don't pull a second full browser download.
//
// All imports are dynamic so unrelated code paths (type-checking, unit tests,
// cold starts on other routes) never load the browser packages.

import type { Browser } from "puppeteer-core";

function isServerless(): boolean {
  return (
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.VERCEL ||
    process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production"
  );
}

/**
 * Launch a headless Chromium and return a puppeteer-core Browser. Callers must
 * `await browser.close()` in a finally block.
 */
export async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default;

  if (isServerless()) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  // Local dev: point puppeteer-core at Playwright's bundled Chromium.
  const { chromium: pwChromium } = await import("playwright-core");
  const executablePath = pwChromium.executablePath();
  if (!executablePath) {
    throw new Error(
      "No local Chromium found. Run `npx playwright install chromium` for local rendering.",
    );
  }
  return puppeteer.launch({ executablePath, headless: true });
}
