import { describe, expect, it } from "vitest";
import { MODELS, modelFor, systemWithCachedBrand } from "@/lib/claude";

describe("modelFor", () => {
  it("routes content to sonnet 4.6", () => {
    expect(modelFor("content")).toBe("claude-sonnet-4-6");
  });

  it("routes refine to opus 4.7", () => {
    expect(modelFor("refine")).toBe("claude-opus-4-7");
  });

  it("routes extract to haiku 4.5 (cheap + fast)", () => {
    expect(modelFor("extract")).toBe("claude-haiku-4-5");
  });

  it("MODELS is complete across all kinds", () => {
    expect(Object.keys(MODELS).sort()).toEqual([
      "content",
      "extract",
      "refine",
    ]);
  });
});

describe("systemWithCachedBrand", () => {
  it("returns a single text block with ephemeral cache control", () => {
    const blocks = systemWithCachedBrand("Base.", "Brand context body");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
    expect(blocks[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("wraps the brand context in delimiter tags", () => {
    const blocks = systemWithCachedBrand("System", "palette + voice + etc");
    expect(blocks[0].text).toContain("System");
    expect(blocks[0].text).toMatch(
      /<brand_context>[\s\S]*palette \+ voice \+ etc[\s\S]*<\/brand_context>/,
    );
  });

  it("keeps the base system text first so a follow-up breakpoint can land downstream", () => {
    const blocks = systemWithCachedBrand("LEAD", "trail");
    expect(blocks[0].text.indexOf("LEAD")).toBeLessThan(
      blocks[0].text.indexOf("trail"),
    );
  });
});
