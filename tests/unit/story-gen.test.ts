import { describe, expect, it } from "vitest";
import {
  buildStorySystem,
  buildStoryUser,
  parseStoryPayload,
  StoryParseError,
} from "@/lib/story-gen";

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
  title: "Confiar em mim",
  pillar: "Autoconhecimento",
  hook: "Olha só o que aconteceu…",
  caption: "Caption original.",
  hashtags: ["#autoconfiança"],
  slides: [
    { position: 1, headline: "Parei", body: "De duvidar de mim." },
    { position: 2, headline: "Comecei", body: "A ouvir minha intuição." },
    { position: 3, headline: "Virei", body: "Outra pessoa." },
  ],
};

describe("buildStorySystem", () => {
  it("includes language + brand + story count + narrative arc rule", () => {
    const out = buildStorySystem(brand, "pt-BR", 3);
    expect(out).toContain("Portuguese (Brazil)");
    expect(out).toContain("Nayara");
    expect(out).toContain("exactly 3 stories");
    expect(out).toMatch(/tease → insight → CTA/);
  });

  it("requires sticker_cta on the last story", () => {
    const out = buildStorySystem(null, "en", 3);
    expect(out).toMatch(/last story MUST include a sticker_cta/);
    expect(out).toContain("no brand kit");
  });

  it("parameterizes count correctly (5 stories)", () => {
    const out = buildStorySystem(brand, "pt-BR", 5);
    expect(out).toContain("exactly 5 stories");
  });
});

describe("buildStoryUser", () => {
  it("serializes source carousel with slide lines + count header", () => {
    const u = buildStoryUser(snapshot, "pt-BR", 3);
    expect(u).toContain("Generate 3 Instagram Stories");
    expect(u).toContain("<source_carousel>");
    expect(u).toContain("title: Confiar em mim");
    expect(u).toContain("Slide 1:");
    expect(u).toContain("Slide 3:");
  });
});

describe("parseStoryPayload", () => {
  const payload = JSON.stringify({
    stories: [
    {
      headline: "Você também faz isso?",
      body: "Buscar validação antes de se ouvir.",
      sticker_cta: null,
    },
    {
      headline: "A chave foi uma só",
      body: "Silenciar o ruído e ouvir a intuição.",
      sticker_cta: null,
    },
    {
      headline: "Confere o carrossel",
      body: "Tudo o que aprendi tá lá — passa no feed pra ver.",
      sticker_cta: "Link in bio",
    },
    ],
  });

  it("parses a well-formed response", () => {
    const out = parseStoryPayload(payload, 3);
    expect(out.stories).toHaveLength(3);
    expect(out.stories[2].stickerCta).toBe("Link in bio");
    expect(out.stories[0].stickerCta).toBeNull();
  });

  it("strips markdown fences", () => {
    const fenced = "```json\n" + payload + "\n```";
    expect(parseStoryPayload(fenced, 3).stories).toHaveLength(3);
  });

  it("throws if story count mismatches", () => {
    expect(() => parseStoryPayload(payload, 5)).toThrow(StoryParseError);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseStoryPayload("nope", 3)).toThrow(StoryParseError);
  });

  it("throws when a story has neither headline nor body", () => {
    const broken = JSON.stringify({
      stories: [
        { headline: "", body: "", sticker_cta: null },
        { headline: "ok", body: "", sticker_cta: null },
        { headline: "ok", body: "", sticker_cta: "Link" },
      ],
    });
    expect(() => parseStoryPayload(broken, 3)).toThrow(StoryParseError);
  });

  it("treats empty/whitespace sticker_cta as null", () => {
    const raw = JSON.stringify({
      stories: [
        { headline: "A", body: "", sticker_cta: "   " },
        { headline: "B", body: "", sticker_cta: "" },
        { headline: "C", body: "", sticker_cta: "Link in bio" },
      ],
    });
    const out = parseStoryPayload(raw, 3);
    expect(out.stories[0].stickerCta).toBeNull();
    expect(out.stories[1].stickerCta).toBeNull();
    expect(out.stories[2].stickerCta).toBe("Link in bio");
  });
});
