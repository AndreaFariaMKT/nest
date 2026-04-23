import { describe, expect, it } from "vitest";
import { buildReportHtml } from "@/lib/report-pdf";

const base = {
  clientName: "Nayara Aquino",
  periodLabel: "April 2026",
  generatedAtLabel: "Apr 23, 2026",
  summary: "Dormant month — zero posts shipped.",
  highlights: ["0 drafts created", "1 open task rolling over"],
  lessons: ["Re-engage production ritual in May."],
  nextPillars: ["Voice & authority", "Client stories"],
  counts: [
    { label: "Drafts created", value: "0" },
    { label: "Posts published", value: "0" },
    { label: "Meetings held", value: "0" },
  ],
};

describe("buildReportHtml", () => {
  it("includes client name, period, and generated-at in the header", () => {
    const html = buildReportHtml(base);
    expect(html).toContain("Nayara Aquino");
    expect(html).toContain("April 2026");
    expect(html).toContain("Apr 23, 2026");
  });

  it("escapes HTML in user content", () => {
    const html = buildReportHtml({
      ...base,
      summary: '<script>alert("x")</script>',
    });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("renders every highlight and lesson as a <li>", () => {
    const html = buildReportHtml(base);
    expect(html.match(/<li>/g)?.length).toBeGreaterThanOrEqual(
      base.highlights.length + base.lessons.length + base.nextPillars.length,
    );
  });

  it("renders empty lists as a muted em dash", () => {
    const html = buildReportHtml({ ...base, lessons: [] });
    expect(html).toMatch(/<p class="muted">—<\/p>/);
  });

  it("lays counts into the stats grid", () => {
    const html = buildReportHtml(base);
    expect(html).toContain("Drafts created");
    expect(html).toContain("Posts published");
  });

  it("produces valid HTML (doctype + closing tags)", () => {
    const html = buildReportHtml(base);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html.endsWith("</html>")).toBe(true);
  });
});
