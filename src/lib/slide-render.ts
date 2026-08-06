// Server-side slide rendering: HTML template + headless Chromium → PNG.
//
// Runs both locally and on Vercel serverless via the shared launcher in
// ./browser (puppeteer-core + @sparticuz/chromium in prod).

import type { BrandColor, BrandTypography } from "@/types/database";

import { launchBrowser } from "@/lib/browser";

export type SlideContent = {
  headline: string | null;
  body: string | null;
  position: number;
};

export type SlideBrand = {
  name: string;
  palette: BrandColor[];
  typography: BrandTypography | null;
};

/**
 * Build the HTML+inline-CSS for a single Instagram portrait slide.
 * Dimensions: 1080×1350 (4:5 portrait). No external fonts — we rely on
 * system fallbacks so the renderer doesn't depend on network.
 */
export function buildSlideHtml(slide: SlideContent, brand: SlideBrand): string {
  const primary = brand.palette[0]?.hex ?? "#1a1a1a";
  const accent = brand.palette[1]?.hex ?? "#f4f1ea";
  const heading = brand.typography?.headings || "system-ui";
  const body = brand.typography?.body || "system-ui";
  const total = Math.max(slide.position, 1);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1080px; height: 1350px; overflow: hidden; }
  body {
    background: ${primary};
    color: ${accent};
    font-family: "${body}", system-ui, -apple-system, sans-serif;
    padding: 96px 80px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 20px;
    opacity: 0.7;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  main {
    display: flex;
    flex-direction: column;
    gap: 36px;
  }
  h1 {
    font-family: "${heading}", "${body}", serif;
    font-size: ${slide.headline && slide.headline.length > 40 ? 72 : 88}px;
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.02em;
    max-width: 900px;
  }
  p {
    font-size: 32px;
    line-height: 1.4;
    max-width: 880px;
    opacity: 0.92;
  }
  footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 22px;
    opacity: 0.65;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 9999px;
    background: ${accent};
    display: inline-block;
    margin-right: 12px;
  }
</style>
</head>
<body>
  <header>
    <span><span class="dot"></span>${escapeHtml(brand.name)}</span>
    <span>${total}</span>
  </header>
  <main>
    ${slide.headline ? `<h1>${escapeHtml(slide.headline)}</h1>` : ""}
    ${slide.body ? `<p>${escapeHtml(slide.body)}</p>` : ""}
  </main>
  <footer>
    <span>${escapeHtml(brand.name.toLowerCase())}</span>
  </footer>
</body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render the HTML to a PNG buffer using headless Chromium. */
export async function renderSlideToPng(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const png = await page.screenshot({ type: "png", fullPage: false });
    return Buffer.from(png);
  } finally {
    await browser.close();
  }
}

export function buildSlidePath(draftId: string, slideId: string, version: number): string {
  return `${draftId}/${slideId}-v${version}.png`;
}
