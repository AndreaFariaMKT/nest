import { describe, expect, it } from "vitest";
import {
  buildBrandContext,
  buildSystem,
  buildUser,
  DraftsParseError,
  parseDraftsPayload,
} from "@/lib/carousel-prompt";

describe("buildBrandContext", () => {
  it("serializes palette / typography / do-don't compactly", () => {
    const ctx = buildBrandContext({
      name: "Nayara",
      palette: [
        { name: "Primary", hex: "#1a1a1a" },
        { name: "Accent", hex: "#d4a44a" },
      ],
      typography: { headings: "Manier", body: "Inter" },
      voiceTone: "Warm, confident.",
      doList: ["Lead with outcomes", "Use examples"],
      dontList: ["Empty buzzwords"],
    });
    expect(ctx).toContain("Brand: Nayara");
    expect(ctx).toContain("Palette: Primary (#1a1a1a), Accent (#d4a44a)");
    expect(ctx).toContain("Typography: headings=Manier, body=Inter");
    expect(ctx).toContain("Warm, confident.");
    expect(ctx).toContain("Lead with outcomes");
    expect(ctx).toContain("Empty buzzwords");
  });

  it("handles null brand kit", () => {
    expect(buildBrandContext(null)).toContain("no brand kit");
  });
});

describe("buildSystem", () => {
  it("includes language label for pt-BR", () => {
    const sys = buildSystem(null, "pt-BR");
    expect(sys).toContain("Portuguese (Brazil)");
  });
  it("forbids markdown code fences", () => {
    expect(buildSystem(null, "en")).toMatch(/no markdown/i);
  });
});

describe("buildUser", () => {
  it("wraps transcript + recent drafts in tags", () => {
    const user = buildUser("Olá.", [{ title: "Old", pillar: "Auth" }], "pt-BR");
    expect(user).toContain("<transcript>\nOlá.\n</transcript>");
    expect(user).toContain("<recent_drafts>");
    expect(user).toContain("- Old · Auth");
  });
  it("notes when recent drafts list is empty", () => {
    const user = buildUser("Hi", [], "en");
    expect(user).toMatch(/first batch/i);
  });
});

describe("parseDraftsPayload", () => {
  const valid = JSON.stringify({
    drafts: [
      {
        title: "First draft",
        pillar: "Education",
        hook: "Did you know...",
        caption: "A caption",
        hashtags: ["invest", "#finance"],
        slides: [
          { headline: "Stop", body: "Stop doing X." },
          { headline: "Start", body: "Start doing Y." },
        ],
      },
    ],
  });

  it("parses a well-formed payload", () => {
    const out = parseDraftsPayload(valid);
    expect(out.drafts).toHaveLength(1);
    expect(out.drafts[0].title).toBe("First draft");
    expect(out.drafts[0].slides).toHaveLength(2);
    // Prefixes '#' if missing
    expect(out.drafts[0].hashtags).toEqual(["#invest", "#finance"]);
  });

  it("strips markdown code fences around JSON", () => {
    const fenced = "```json\n" + valid + "\n```";
    expect(parseDraftsPayload(fenced).drafts).toHaveLength(1);
  });

  it("drops drafts without title or slides", () => {
    const payload = JSON.stringify({
      drafts: [
        { title: "", slides: [{ headline: "X", body: "Y" }] },
        { title: "No slides", slides: [] },
        { title: "Good", slides: [{ headline: "H", body: "B" }] },
      ],
    });
    expect(parseDraftsPayload(payload).drafts).toHaveLength(1);
  });

  it("throws on empty response", () => {
    expect(() => parseDraftsPayload("")).toThrow(DraftsParseError);
  });
  it("throws on invalid JSON", () => {
    expect(() => parseDraftsPayload("not json")).toThrow(DraftsParseError);
  });
  it("throws when drafts is not an array", () => {
    expect(() => parseDraftsPayload('{"drafts": "oops"}')).toThrow(
      DraftsParseError,
    );
  });
  it("throws when no usable drafts remain after filtering", () => {
    expect(() =>
      parseDraftsPayload('{"drafts": [{"title": "", "slides": []}]}'),
    ).toThrow(DraftsParseError);
  });
});
