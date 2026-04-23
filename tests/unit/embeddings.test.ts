import { describe, expect, it } from "vitest";
import {
  buildDraftEmbedText,
  cosineSimilarity,
  EMBEDDING_DIMS,
  hasEmbeddingsProvider,
  parseVector,
  vectorToSql,
} from "@/lib/embeddings";

describe("hasEmbeddingsProvider", () => {
  it("returns false when VOYAGE_API_KEY is missing or whitespace", () => {
    expect(hasEmbeddingsProvider({})).toBe(false);
    expect(hasEmbeddingsProvider({ VOYAGE_API_KEY: "" })).toBe(false);
    expect(hasEmbeddingsProvider({ VOYAGE_API_KEY: "   " })).toBe(false);
  });
  it("returns true when set", () => {
    expect(hasEmbeddingsProvider({ VOYAGE_API_KEY: "pa-abc" })).toBe(true);
  });
});

describe("EMBEDDING_DIMS", () => {
  it("matches voyage-3.5 default", () => {
    expect(EMBEDDING_DIMS).toBe(1024);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1);
  });
  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });
  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1, 10);
  });
  it("is scale-invariant", () => {
    expect(cosineSimilarity([3, 4], [6, 8])).toBeCloseTo(1, 10);
  });
  it("throws on length mismatch", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
  });
  it("returns 0 when either vector is all zeros (no direction)", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

describe("vectorToSql + parseVector", () => {
  it("serializes to pgvector literal", () => {
    expect(vectorToSql([1, 2.5, -0.3])).toBe("[1,2.5,-0.3]");
  });
  it("round-trips through parseVector", () => {
    const original = [0.1, -0.2, 0.333, 4];
    expect(parseVector(vectorToSql(original))).toEqual(original);
  });
  it("handles empty vector", () => {
    expect(vectorToSql([])).toBe("[]");
    expect(parseVector("[]")).toEqual([]);
  });
  it("throws on invalid literal", () => {
    expect(() => parseVector("not a vector")).toThrow();
    expect(() => parseVector("[1,foo,3]")).toThrow();
  });
});

describe("buildDraftEmbedText", () => {
  it("joins title + pillar + hook with a separator", () => {
    expect(
      buildDraftEmbedText({
        title: "Why I pivoted",
        pillar: "Positioning",
        hook: "This changed everything",
      }),
    ).toBe("Why I pivoted · Positioning · This changed everything");
  });
  it("drops nulls cleanly", () => {
    expect(
      buildDraftEmbedText({
        title: "Only title",
        pillar: null,
        hook: null,
      }),
    ).toBe("Only title");
  });
  it("drops empty strings too", () => {
    expect(
      buildDraftEmbedText({ title: "t", pillar: "", hook: "h" }),
    ).toBe("t · h");
  });
});
