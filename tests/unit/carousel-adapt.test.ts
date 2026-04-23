import { describe, expect, it } from "vitest";
import {
  AdaptParseError,
  buildAdaptSystem,
  buildAdaptUser,
  parseAdaptPayload,
} from "@/lib/carousel-adapt";

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
  caption: "Caption original do Instagram.",
  hashtags: ["#autoconfiança", "#jornada"],
  slides: [
    { position: 1, headline: "Parei", body: "De duvidar de mim." },
    { position: 2, headline: "Comecei", body: "A ouvir minha intuição." },
  ],
};

describe("buildAdaptSystem", () => {
  it("includes language + brand + LinkedIn rules", () => {
    const out = buildAdaptSystem(brand, "pt-BR", "linkedin");
    expect(out).toContain("Portuguese (Brazil)");
    expect(out).toContain("Nayara");
    expect(out).toContain("Target platform: LinkedIn");
    expect(out).toContain("3000 characters");
  });

  it("includes TikTok-specific rules when platform is tiktok", () => {
    const out = buildAdaptSystem(null, "en", "tiktok");
    expect(out).toContain("Target platform: TikTok");
    expect(out).toContain("voiceover script");
    expect(out).toContain("no brand kit");
  });

  it("instructs Claude to keep same slide count + order", () => {
    const out = buildAdaptSystem(null, "pt-BR", "linkedin");
    expect(out).toMatch(/SAME number of slides/);
    expect(out).toMatch(/SAME order/);
  });
});

describe("buildAdaptUser", () => {
  it("serializes source draft with target platform header", () => {
    const u = buildAdaptUser(snapshot, "pt-BR", "linkedin");
    expect(u).toContain("Target platform: linkedin");
    expect(u).toContain("<source_draft>");
    expect(u).toContain("title: Confiar em mim");
    expect(u).toContain("Slide 1:");
    expect(u).toContain("Slide 2:");
  });

  it("passes through TikTok as target platform", () => {
    const u = buildAdaptUser(snapshot, "en", "tiktok");
    expect(u).toContain("Target platform: tiktok");
  });
});

describe("parseAdaptPayload", () => {
  const payload = JSON.stringify({
    title: "Confiar em mim — versão LinkedIn",
    hook: "A maior virada da minha carreira foi parar de pedir permissão.",
    caption: "Caption profissional pra LinkedIn com contexto + reflexão + CTA.",
    hashtags: ["lideranca", "#autoconhecimento", "#carreira"],
    slides: [
      {
        headline: "Parei de me duvidar",
        body: "E descobri uma liderança mais firme.",
      },
      {
        headline: "Comecei a ouvir meu instinto",
        body: "As decisões passaram a ser mais claras.",
      },
    ],
  });

  it("parses a well-formed response", () => {
    const out = parseAdaptPayload(payload, 2);
    expect(out.title).toContain("LinkedIn");
    expect(out.slides).toHaveLength(2);
    expect(out.hashtags).toEqual([
      "#lideranca",
      "#autoconhecimento",
      "#carreira",
    ]);
    expect(out.hook).toMatch(/virada/);
  });

  it("strips markdown fences", () => {
    const fenced = "```json\n" + payload + "\n```";
    expect(parseAdaptPayload(fenced, 2).slides).toHaveLength(2);
  });

  it("throws if slide count mismatches", () => {
    expect(() => parseAdaptPayload(payload, 3)).toThrow(AdaptParseError);
  });

  it("throws on missing title", () => {
    const broken = JSON.stringify({
      slides: [
        { headline: "A", body: "" },
        { headline: "B", body: "" },
      ],
    });
    expect(() => parseAdaptPayload(broken, 2)).toThrow(AdaptParseError);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseAdaptPayload("nope", 2)).toThrow(AdaptParseError);
  });

  it("throws when a slide has neither headline nor body", () => {
    const broken = JSON.stringify({
      title: "T",
      slides: [
        { headline: "", body: "" },
        { headline: "ok", body: "" },
      ],
    });
    expect(() => parseAdaptPayload(broken, 2)).toThrow(AdaptParseError);
  });

  it("normalizes hashtags: adds # prefix, trims, drops empties", () => {
    const raw = JSON.stringify({
      title: "T",
      hashtags: ["  foo  ", "#bar", "", "baz"],
      slides: [
        { headline: "A", body: "" },
        { headline: "B", body: "" },
      ],
    });
    expect(parseAdaptPayload(raw, 2).hashtags).toEqual([
      "#foo",
      "#bar",
      "#baz",
    ]);
  });

  it("handles missing optional fields (hook/caption/hashtags) gracefully", () => {
    const minimal = JSON.stringify({
      title: "T",
      slides: [
        { headline: "A", body: "" },
        { headline: "B", body: "" },
      ],
    });
    const out = parseAdaptPayload(minimal, 2);
    expect(out.hook).toBeNull();
    expect(out.caption).toBeNull();
    expect(out.hashtags).toEqual([]);
  });
});
