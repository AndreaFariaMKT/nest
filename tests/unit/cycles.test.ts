import { describe, expect, it } from "vitest";
import {
  currentYearMonth,
  cycleBounds,
  daysRemainingInCycle,
  isCycleActive,
} from "@/lib/cycles";

describe("currentYearMonth", () => {
  it("extracts UTC year/month", () => {
    expect(currentYearMonth(new Date("2026-04-22T10:00:00Z"))).toEqual({
      year: 2026,
      month: 4,
    });
  });

  it("handles year boundary (UTC)", () => {
    expect(currentYearMonth(new Date("2026-01-01T00:00:00Z"))).toEqual({
      year: 2026,
      month: 1,
    });
    expect(currentYearMonth(new Date("2025-12-31T23:59:59Z"))).toEqual({
      year: 2025,
      month: 12,
    });
  });
});

describe("cycleBounds", () => {
  it("covers a full 31-day month (January)", () => {
    expect(cycleBounds(2026, 1)).toEqual({
      year: 2026,
      month: 1,
      startsOn: "2026-01-01",
      endsOn: "2026-01-31",
    });
  });

  it("handles February in a leap year", () => {
    expect(cycleBounds(2024, 2)).toEqual({
      year: 2024,
      month: 2,
      startsOn: "2024-02-01",
      endsOn: "2024-02-29",
    });
  });

  it("handles February in a non-leap year", () => {
    expect(cycleBounds(2026, 2).endsOn).toBe("2026-02-28");
  });

  it("handles 30-day months (April)", () => {
    expect(cycleBounds(2026, 4).endsOn).toBe("2026-04-30");
  });

  it("handles December", () => {
    expect(cycleBounds(2026, 12)).toEqual({
      year: 2026,
      month: 12,
      startsOn: "2026-12-01",
      endsOn: "2026-12-31",
    });
  });

  it("rejects out-of-range months", () => {
    expect(() => cycleBounds(2026, 0)).toThrow();
    expect(() => cycleBounds(2026, 13)).toThrow();
  });
});

describe("isCycleActive", () => {
  it("returns true when today is inside the cycle", () => {
    const bounds = cycleBounds(2026, 4);
    expect(isCycleActive(bounds, "2026-04-15")).toBe(true);
    expect(isCycleActive(bounds, "2026-04-01")).toBe(true);
    expect(isCycleActive(bounds, "2026-04-30")).toBe(true);
  });

  it("returns false outside the cycle", () => {
    const bounds = cycleBounds(2026, 4);
    expect(isCycleActive(bounds, "2026-03-31")).toBe(false);
    expect(isCycleActive(bounds, "2026-05-01")).toBe(false);
  });
});

describe("daysRemainingInCycle", () => {
  it("counts full days left including today", () => {
    const bounds = cycleBounds(2026, 4);
    expect(daysRemainingInCycle(bounds, "2026-04-28")).toBe(2);
  });
  it("returns 0 on the last day", () => {
    const bounds = cycleBounds(2026, 4);
    expect(daysRemainingInCycle(bounds, "2026-04-30")).toBe(0);
  });
  it("returns 0 past the end", () => {
    const bounds = cycleBounds(2026, 4);
    expect(daysRemainingInCycle(bounds, "2026-05-15")).toBe(0);
  });
});
