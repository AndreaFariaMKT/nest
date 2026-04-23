import { describe, expect, it } from "vitest";
import {
  estimateCostUsd,
  findRate,
  formatUsd,
} from "@/lib/claude-pricing";

describe("findRate", () => {
  it("matches by exact model id", () => {
    expect(findRate("claude-opus-4-7")).toMatchObject({
      inputPerMillion: 5,
      outputPerMillion: 25,
    });
  });

  it("case-insensitive", () => {
    expect(findRate("Claude-Sonnet-4-6")).toMatchObject({
      inputPerMillion: 3,
    });
  });

  it("returns null for unknown model", () => {
    expect(findRate("gpt-4")).toBeNull();
    expect(findRate(null)).toBeNull();
    expect(findRate(undefined)).toBeNull();
  });
});

describe("estimateCostUsd", () => {
  it("opus 4.7: 1M in + 1M out = $30", () => {
    expect(estimateCostUsd("claude-opus-4-7", 1_000_000, 1_000_000)).toBeCloseTo(30, 4);
  });

  it("haiku: 500k in + 500k out", () => {
    // haiku: 1 + 5 → 500k in = 0.5, 500k out = 2.5 → total 3
    expect(estimateCostUsd("claude-haiku-4-5", 500_000, 500_000)).toBeCloseTo(3, 4);
  });

  it("sonnet: 10k in + 5k out", () => {
    // 10k * 3/1M + 5k * 15/1M = 0.03 + 0.075 = 0.105
    expect(estimateCostUsd("claude-sonnet-4-6", 10_000, 5_000)).toBeCloseTo(0.105, 4);
  });

  it("returns 0 for unknown model", () => {
    expect(estimateCostUsd("unknown", 1000, 1000)).toBe(0);
  });
});

describe("formatUsd", () => {
  it("keeps 4 decimals under 1 cent", () => {
    expect(formatUsd(0.0042)).toBe("$0.0042");
  });

  it("keeps 2 decimals >= 1 cent", () => {
    expect(formatUsd(0.42)).toBe("$0.42");
    expect(formatUsd(12.3456)).toBe("$12.35");
  });

  it("shows $0 for zero", () => {
    expect(formatUsd(0)).toBe("$0");
  });
});
