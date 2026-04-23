import { describe, expect, it } from "vitest";
import {
  buildReelSystem,
  buildReelUser,
  parseReelPayload,
  ReelParseError,
} from "@/lib/reel-script";

const brand = {
  name: "Nayara",
  palette: [{ name: "Primary", hex: "#1a1a1a" }],
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
  ],
};

describe("buildReelSystem", () => {
  it("includes language + brand + 30-60s constraint + hook-line rule", () => {
    const out = buildReelSystem(brand, "pt-BR");
    expect(out).toContain("Portuguese (Brazil)");
    expect(out).toContain("Nayara");
    expect(out).toContain("30-60 seconds");
    expect(out).toMatch(/hook_line is the FIRST line/);
  });

  it("handles null brand", () => {
    expect(buildReelSystem(null, "en")).toContain("no brand kit");
  });
});

describe("buildReelUser", () => {
  it("serializes source carousel with slide lines", () => {
    const u = buildReelUser(snapshot, "pt-BR");
    expect(u).toContain("<source_carousel>");
    expect(u).toContain("title: Confiar em mim");
    expect(u).toContain("Slide 1:");
    expect(u).toContain("Slide 2:");
  });
});

describe("parseReelPayload", () => {
  const payload = JSON.stringify({
    title: "Confiar em mim — Reel",
    hook_line: "Você já percebeu que pede permissão pra viver?",
    script:
      "Você já percebeu que pede permissão pra viver?\nA validação vira vício — todo passo passa por aprovação externa.\nMas existe uma alternativa: ouvir sua intuição primeiro.\nQuando eu fiz isso, tudo mudou — carreira, relacionamentos, decisões.\nSalva esse Reel e me conta: onde você mais busca validação?",
    caption: "Uma virada de chave que muda o jogo.",
    hashtags: ["autoconfiança", "#autoconhecimento"],
    estimated_duration_sec: 45,
  });

  it("parses a well-formed response", () => {
    const out = parseReelPayload(payload);
    expect(out.title).toContain("Reel");
    expect(out.hookLine).toMatch(/permissão/);
    expect(out.script.split("\n")).toHaveLength(5);
    expect(out.estimatedDurationSec).toBe(45);
    expect(out.hashtags).toEqual(["#autoconfiança", "#autoconhecimento"]);
  });

  it("strips markdown fences", () => {
    const fenced = "```json\n" + payload + "\n```";
    expect(parseReelPayload(fenced).title).toContain("Reel");
  });

  it("throws on missing title", () => {
    const broken = JSON.stringify({
      hook_line: "hook",
      script: "a".repeat(50),
    });
    expect(() => parseReelPayload(broken)).toThrow(ReelParseError);
  });

  it("throws on missing hook_line", () => {
    const broken = JSON.stringify({
      title: "T",
      script: "a".repeat(50),
    });
    expect(() => parseReelPayload(broken)).toThrow(ReelParseError);
  });

  it("throws on too-short script", () => {
    const broken = JSON.stringify({
      title: "T",
      hook_line: "h",
      script: "short",
    });
    expect(() => parseReelPayload(broken)).toThrow(ReelParseError);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseReelPayload("nope")).toThrow(ReelParseError);
  });

  it("clamps estimated_duration_sec into [10, 120]", () => {
    const low = parseReelPayload(
      JSON.stringify({
        title: "T",
        hook_line: "h",
        script: "a".repeat(50),
        estimated_duration_sec: 3,
      }),
    );
    expect(low.estimatedDurationSec).toBe(10);

    const high = parseReelPayload(
      JSON.stringify({
        title: "T",
        hook_line: "h",
        script: "a".repeat(50),
        estimated_duration_sec: 999,
      }),
    );
    expect(high.estimatedDurationSec).toBe(120);
  });

  it("defaults estimated_duration_sec to 45 when absent", () => {
    const out = parseReelPayload(
      JSON.stringify({
        title: "T",
        hook_line: "h",
        script: "a".repeat(50),
      }),
    );
    expect(out.estimatedDurationSec).toBe(45);
  });

  it("handles missing optional fields gracefully", () => {
    const out = parseReelPayload(
      JSON.stringify({
        title: "T",
        hook_line: "h",
        script: "a".repeat(50),
      }),
    );
    expect(out.caption).toBeNull();
    expect(out.hashtags).toEqual([]);
  });
});
