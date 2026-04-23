import { describe, expect, it } from "vitest";
import {
  buildReportSystem,
  buildReportUser,
  monthBounds,
  MonthlyReportParseError,
  parseReportPayload,
} from "@/lib/monthly-report";

const sampleInput = {
  clientName: "Nayara Aquino",
  clientIndustry: "Coaching",
  period: { year: 2026, month: 4, label: "April 2026" },
  counts: {
    draftsCreated: 18,
    draftsApproved: 12,
    postsPublished: 9,
    tasksCompleted: 24,
    tasksOpen: 4,
    meetingsHeld: 3,
    approvalsSent: 14,
    approvalsApproved: 11,
    approvalsRejected: 3,
  },
  topDrafts: [
    { title: "Confiar em mim", pillar: "Autoconhecimento", status: "published" },
    { title: "Pivotear sem medo", pillar: "Posicionamento", status: "approved" },
  ],
  pillars: [
    { name: "Autoconhecimento", count: 6 },
    { name: "Posicionamento", count: 4 },
  ],
};

describe("buildReportSystem", () => {
  it("declares language + JSON-only + no fences", () => {
    const out = buildReportSystem("pt-BR");
    expect(out).toContain("Portuguese (Brazil)");
    expect(out).toMatch(/raw JSON only/);
    expect(out).toMatch(/markdown fences/);
  });

  it("lists the required fields in schema", () => {
    const out = buildReportSystem("en");
    for (const k of ["summary", "highlights", "lessons", "nextPillars"]) {
      expect(out).toContain(k);
    }
  });
});

describe("buildReportUser", () => {
  it("serializes counts + pillars + drafts", () => {
    const u = buildReportUser(sampleInput, "pt-BR");
    expect(u).toContain("Nayara Aquino — Coaching");
    expect(u).toContain("April 2026");
    expect(u).toContain("drafts created: 18");
    expect(u).toContain("Autoconhecimento: 6 drafts");
    expect(u).toContain("Confiar em mim");
  });

  it("handles empty pillars + empty drafts gracefully", () => {
    const u = buildReportUser(
      { ...sampleInput, pillars: [], topDrafts: [] },
      "en",
    );
    expect(u).toContain("(no pillars recorded)");
    expect(u).toContain("(no drafts produced)");
  });
});

describe("parseReportPayload", () => {
  const payload = JSON.stringify({
    summary:
      "Nayara publicou 9 posts em abril, com engajamento concentrado no pilar de Autoconhecimento.",
    highlights: [
      "9 posts publicados (77% do previsto)",
      "Top post foi o carrossel Confiar em mim",
    ],
    lessons: ["Posts com hook em primeira pessoa tiveram 2x mais save"],
    nextPillars: ["Liderança feminina", "Decisões sob pressão"],
  });

  it("parses a well-formed payload", () => {
    const out = parseReportPayload(payload);
    expect(out.summary).toMatch(/9 posts/);
    expect(out.highlights).toHaveLength(2);
    expect(out.nextPillars).toEqual(["Liderança feminina", "Decisões sob pressão"]);
  });

  it("strips markdown fences", () => {
    const fenced = "```json\n" + payload + "\n```";
    expect(parseReportPayload(fenced).highlights).toHaveLength(2);
  });

  it("throws on missing summary", () => {
    const broken = JSON.stringify({ highlights: ["a"], lessons: [], nextPillars: [] });
    expect(() => parseReportPayload(broken)).toThrow(MonthlyReportParseError);
  });

  it("throws on empty highlights", () => {
    const broken = JSON.stringify({
      summary: "Short but valid.",
      highlights: [],
      lessons: [],
      nextPillars: [],
    });
    expect(() => parseReportPayload(broken)).toThrow(MonthlyReportParseError);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseReportPayload("nope")).toThrow(MonthlyReportParseError);
  });

  it("drops empty string entries inside the arrays", () => {
    const raw = JSON.stringify({
      summary: "Short but valid summary text.",
      highlights: ["a", "", " "],
      lessons: ["b"],
      nextPillars: ["c"],
    });
    expect(parseReportPayload(raw).highlights).toEqual(["a"]);
  });
});

describe("monthBounds", () => {
  it("spans Apr 1 → May 1 UTC", () => {
    expect(monthBounds(2026, 4)).toEqual({
      startISO: "2026-04-01T00:00:00.000Z",
      endISO: "2026-05-01T00:00:00.000Z",
    });
  });

  it("rolls year forward on December", () => {
    expect(monthBounds(2026, 12)).toEqual({
      startISO: "2026-12-01T00:00:00.000Z",
      endISO: "2027-01-01T00:00:00.000Z",
    });
  });
});
