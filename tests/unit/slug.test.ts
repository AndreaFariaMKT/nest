import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and dashes basic input", () => {
    expect(slugify("Nayara Aquino")).toBe("nayara-aquino");
  });

  it("strips Portuguese diacritics", () => {
    expect(slugify("João Pédro Âçucar")).toBe("joao-pedro-acucar");
  });

  it("collapses non-alphanumerics into single dashes", () => {
    expect(slugify("  Hello  —  world! ")).toBe("hello-world");
  });

  it("drops leading and trailing dashes", () => {
    expect(slugify("---edge---")).toBe("edge");
  });

  it("caps at 60 characters", () => {
    const long = "a".repeat(200);
    expect(slugify(long)).toHaveLength(60);
  });

  it("returns an empty string for empty input", () => {
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("handles numbers and underscores gracefully", () => {
    expect(slugify("Studio_42 · vol. 3")).toBe("studio-42-vol-3");
  });
});
