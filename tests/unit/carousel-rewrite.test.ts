import { describe, expect, it } from "vitest";
import {
  buildRewriteSystem,
  buildRewriteUser,
  parseRewritePayload,
  RewriteParseError,
} from "@/lib/carousel-rewrite";

const brand = {
  name: "Nayara",
  palette: [
    { name: "Primary", hex: "#1a1a1a" },
    { name: "Accent", hex: "#d4a44a" },
  ],
  typography: { headings: "Manier", body: "Inter" },
  voiceTone: "Warm, confident.",
  doList: ["Lead with outcomes"],
  dontList: ["Empty buzzwords"],
};

const snapshot = {
  title: "Por que pivotei",
  pillar: "Posicionamento",
  hook: "Olha só o que aconteceu…",
  caption: "Caption original",
  hashtags: ["#invest", "#pivote"],
  slides: [
    { position: 1, headline: "Parei", body: "De querer ser diferente." },
    { position: 2, headline: "Comecei", body: "A ser eu mesma." },
  ],
};

describe("buildRewriteSystem", () => {
  it("includes language label + brand", () => {
    const out = buildRewriteSystem(brand, "pt-BR");
    expect(out).toContain("Portuguese (Brazil)");
    expect(out).toContain("Nayara");
    expect(out).toContain("Palette: Primary (#1a1a1a), Accent (#d4a44a)");
    expect(out).toContain("Warm, confident.");
    expect(out).toContain("Lead with outcomes");
    expect(out).toContain("Empty buzzwords");
  });

  it("instructs Claude to keep same slide count", () => {
    const out = buildRewriteSystem(null, "en");
    expect(out).toMatch(/SAME number of slides/);
    expect(out).toMatch(/SAME order/);
  });

  it("handles null brand", () => {
    expect(buildRewriteSystem(null, "en")).toContain("no brand kit");
  });
});

describe("buildRewriteUser", () => {
  it("serializes current draft with numbered slides and user instruction", () => {
    const u = buildRewriteUser(snapshot, "Deixa mais informal", "pt-BR");
    expect(u).toContain("<current_draft>");
    expect(u).toContain("title: Por que pivotei");
    expect(u).toContain("Slide 1:");
    expect(u).toContain("Slide 2:");
    expect(u).toContain("<user_instruction>\nDeixa mais informal");
  });

  it("trims the instruction", () => {
    const u = buildRewriteUser(snapshot, "   foo   ", "en");
    expect(u).toMatch(/<user_instruction>\nfoo\n<\/user_instruction>/);
  });
});

describe("parseRewritePayload", () => {
  const payload = JSON.stringify({
    slides: [
      { headline: "Parei de fingir", body: "E começou a liberdade." },
      { headline: "Comecei a trocar", body: "Performance por verdade." },
    ],
    hook: "Essa mudança salvou meu negócio",
    caption: "Nova caption",
    notes: "Tom mais direto; headlines mais curtas.",
  });

  it("parses a well-formed response", () => {
    const out = parseRewritePayload(payload, 2);
    expect(out.slides).toHaveLength(2);
    expect(out.slides[0].headline).toBe("Parei de fingir");
    expect(out.hook).toBe("Essa mudança salvou meu negócio");
    expect(out.notes).toMatch(/direto/);
  });

  it("strips markdown fences", () => {
    const fenced = "```json\n" + payload + "\n```";
    expect(parseRewritePayload(fenced, 2).slides).toHaveLength(2);
  });

  it("throws if slide count mismatches", () => {
    expect(() => parseRewritePayload(payload, 3)).toThrow(RewriteParseError);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseRewritePayload("nope", 2)).toThrow(RewriteParseError);
  });

  it("throws when a slide has neither headline nor body", () => {
    const broken = JSON.stringify({
      slides: [
        { headline: "", body: "" },
        { headline: "ok", body: "" },
      ],
    });
    expect(() => parseRewritePayload(broken, 2)).toThrow(RewriteParseError);
  });

  it("handles missing optional fields (hook/caption/notes) as null", () => {
    const minimal = JSON.stringify({
      slides: [
        { headline: "A", body: "" },
        { headline: "B", body: "" },
      ],
    });
    const out = parseRewritePayload(minimal, 2);
    expect(out.hook).toBeNull();
    expect(out.caption).toBeNull();
    expect(out.notes).toBeNull();
  });
});
