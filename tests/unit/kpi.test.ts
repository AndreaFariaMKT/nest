import { describe, expect, it } from "vitest";
import {
  aggregateKpis,
  computeEngagementRate,
  dailyReachSeries,
  latestPerPost,
  parsePeriod,
  toDay,
  type MetricSnapshot,
} from "@/lib/kpi";

const snap = (
  p: string,
  capturedAt: string,
  partial: Partial<MetricSnapshot> = {},
): MetricSnapshot => ({
  publishedPostId: p,
  capturedAt,
  reach: null,
  impressions: null,
  likes: null,
  comments: null,
  saves: null,
  shares: null,
  ...partial,
});

describe("latestPerPost", () => {
  it("keeps only the most recent snapshot per published_post_id", () => {
    const result = latestPerPost([
      snap("a", "2026-05-01T00:00:00Z", { reach: 10 }),
      snap("a", "2026-05-02T00:00:00Z", { reach: 20 }),
      snap("a", "2026-05-03T00:00:00Z", { reach: 30 }),
      snap("b", "2026-05-01T00:00:00Z", { reach: 5 }),
    ]);
    expect(result).toHaveLength(2);
    const a = result.find((r) => r.publishedPostId === "a")!;
    const b = result.find((r) => r.publishedPostId === "b")!;
    expect(a.reach).toBe(30);
    expect(b.reach).toBe(5);
  });

  it("handles empty input", () => {
    expect(latestPerPost([])).toEqual([]);
  });
});

describe("aggregateKpis", () => {
  it("sums latest snapshots and computes engagement rate", () => {
    const totals = aggregateKpis([
      snap("a", "2026-05-01", { reach: 1000, likes: 50, comments: 5, saves: 5, shares: 2, impressions: 1500 }),
      snap("b", "2026-05-01", { reach: 500, likes: 25, comments: 0, saves: 5, shares: 0, impressions: 800 }),
    ]);
    expect(totals.reach).toBe(1500);
    expect(totals.impressions).toBe(2300);
    expect(totals.likes).toBe(75);
    expect(totals.saves).toBe(10);
    expect(totals.postsCovered).toBe(2);
    // (50+5+5+2+25+0+5+0) / 1500 * 100 = 92/1500 * 100 ≈ 6.13%
    expect(totals.engagementRate).toBeCloseTo((92 / 1500) * 100, 2);
  });

  it("treats null fields as 0 for the sum", () => {
    const totals = aggregateKpis([snap("a", "2026-05-01", { reach: 100 })]);
    expect(totals.likes).toBe(0);
    expect(totals.engagementRate).toBe(0);
  });

  it("returns null engagement rate when reach is 0", () => {
    const totals = aggregateKpis([
      snap("a", "2026-05-01", { likes: 5, reach: 0 }),
    ]);
    expect(totals.engagementRate).toBeNull();
  });

  it("returns zeroed totals for empty input", () => {
    const totals = aggregateKpis([]);
    expect(totals.reach).toBe(0);
    expect(totals.engagementRate).toBeNull();
    expect(totals.postsCovered).toBe(0);
  });
});

describe("computeEngagementRate", () => {
  it("returns the correct percentage", () => {
    expect(
      computeEngagementRate({
        likes: 50,
        comments: 10,
        saves: 5,
        shares: 5,
        reach: 1000,
      }),
    ).toBeCloseTo(7, 8);
  });

  it("returns null when reach is 0", () => {
    expect(
      computeEngagementRate({
        likes: 5,
        comments: 0,
        saves: 0,
        shares: 0,
        reach: 0,
      }),
    ).toBeNull();
  });
});

describe("dailyReachSeries", () => {
  it("buckets per UTC day, summing the latest-of-day per post", () => {
    const series = dailyReachSeries([
      snap("a", "2026-05-01T01:00:00Z", { reach: 100 }),
      snap("a", "2026-05-01T05:00:00Z", { reach: 120 }), // newer same day → wins
      snap("a", "2026-05-02T01:00:00Z", { reach: 150 }),
      snap("b", "2026-05-01T03:00:00Z", { reach: 50 }),
    ]);
    expect(series).toEqual([
      { day: "2026-05-01", reach: 170 }, // 120 (a-latest) + 50 (b)
      { day: "2026-05-02", reach: 150 },
    ]);
  });

  it("returns empty for empty input", () => {
    expect(dailyReachSeries([])).toEqual([]);
  });

  it("treats null reach as 0", () => {
    const series = dailyReachSeries([snap("a", "2026-05-01T00:00:00Z")]);
    expect(series).toEqual([{ day: "2026-05-01", reach: 0 }]);
  });
});

describe("parsePeriod", () => {
  const now = new Date("2026-05-15T12:34:56.000Z");

  it("defaults to last 30 days when both bounds missing", () => {
    const { fromIso, toIso } = parsePeriod(null, null, now);
    expect(toIso).toBe("2026-05-15T12:34:56.000Z");
    expect(fromIso).toBe("2026-04-15T12:34:56.000Z");
  });

  it("opens on the first day and closes after the last", () => {
    // `to` is an exclusive bound past the END of the chosen day. This used to
    // assert midnight OF that day, which is what silently dropped it from
    // every range the dashboard reported.
    const { fromIso, toIso } = parsePeriod("2026-01-01", "2026-02-01", now);
    expect(fromIso).toBe("2026-01-01T00:00:00.000Z");
    expect(toIso).toBe("2026-02-02T00:00:00.000Z");
  });

  it("ignores malformed strings", () => {
    const { fromIso, toIso } = parsePeriod("nope", "also-nope", now);
    expect(fromIso).toBe("2026-04-15T12:34:56.000Z");
    expect(toIso).toBe("2026-05-15T12:34:56.000Z");
  });

  it("respects partial — `from` set, `to` defaults", () => {
    const { fromIso, toIso } = parsePeriod("2026-04-01", null, now);
    expect(fromIso).toBe("2026-04-01T00:00:00.000Z");
    expect(toIso).toBe("2026-05-15T12:34:56.000Z");
  });
});

describe("period bounds", () => {
  /**
   * The filter is `.lt(captured_at, toIso)`, and `toIso` used to be midnight
   * OF the chosen day — so picking 1–25 August returned the 1st through the
   * 24th. The form pre-filled `to` with that same value, so submitting it
   * unchanged shrank the range by another day each time.
   */
  it("includes the whole of the last day chosen", () => {
    const p = parsePeriod("2026-08-01", "2026-08-25");
    expect(p.fromIso).toBe("2026-08-01T00:00:00.000Z");
    expect(p.toIso).toBe("2026-08-26T00:00:00.000Z");
  });

  it("gives back the day the person picked, not the bound", () => {
    const p = parsePeriod("2026-08-01", "2026-08-25");
    expect(toDay(p)).toBe("2026-08-25");
  });

  it("round-trips without walking the range forward", () => {
    let p = parsePeriod("2026-08-01", "2026-08-25");
    for (let i = 0; i < 3; i++) p = parsePeriod("2026-08-01", toDay(p));
    expect(toDay(p)).toBe("2026-08-25");
  });
});
