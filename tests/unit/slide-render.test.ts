import { describe, expect, it } from "vitest";
import { buildSlideHtml, buildSlidePath } from "@/lib/slide-render";

const brand = {
  name: "Nayara",
  palette: [
    { name: "Primary", hex: "#1a1a1a" },
    { name: "Accent", hex: "#d4a44a" },
  ],
  typography: { headings: "Manier", body: "Inter" },
};

describe("buildSlideHtml", () => {
  it("injects palette colors and fonts", () => {
    const html = buildSlideHtml(
      { headline: "Stop doing X", body: "Start doing Y.", position: 1 },
      brand,
    );
    expect(html).toContain("background: #1a1a1a");
    expect(html).toContain("color: #d4a44a");
    expect(html).toContain("Manier");
    expect(html).toContain("Inter");
  });

  it("escapes HTML in headline and body", () => {
    const html = buildSlideHtml(
      { headline: "<script>alert(1)</script>", body: "A & B", position: 1 },
      brand,
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
  });

  it("uses sensible defaults when palette or typography is empty", () => {
    const html = buildSlideHtml(
      { headline: "Hi", body: null, position: 2 },
      { name: "NoStyle", palette: [], typography: null },
    );
    // falls back to a dark background
    expect(html).toContain("background: #1a1a1a");
    expect(html).toContain("font-family: \"system-ui\"");
  });

  it("viewport is 1080×1350", () => {
    const html = buildSlideHtml({ headline: "X", body: null, position: 1 }, brand);
    expect(html).toContain("width: 1080px");
    expect(html).toContain("height: 1350px");
  });

  it("uses smaller font size for long headlines", () => {
    const shortHtml = buildSlideHtml(
      { headline: "Short", body: null, position: 1 },
      brand,
    );
    const longHtml = buildSlideHtml(
      { headline: "A".repeat(60), body: null, position: 1 },
      brand,
    );
    expect(shortHtml).toContain("font-size: 88px");
    expect(longHtml).toContain("font-size: 72px");
  });
});

describe("buildSlidePath", () => {
  it("puts draft id first for RLS split_part", () => {
    expect(buildSlidePath("draft-1", "slide-1", 1)).toBe(
      "draft-1/slide-1-v1.png",
    );
  });
  it("bumps version in filename", () => {
    expect(buildSlidePath("d", "s", 3)).toBe("d/s-v3.png");
  });
});
