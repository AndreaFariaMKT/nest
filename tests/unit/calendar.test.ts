import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildMonthGrid,
  formatMonthKey,
  monthRangeISO,
  parseMonthKey,
} from "@/lib/calendar";

describe("parseMonthKey", () => {
  it("accepts YYYY-MM", () => {
    expect(parseMonthKey("2026-04")).toEqual({ year: 2026, month: 4 });
  });

  it("rejects invalid month", () => {
    const now = new Date();
    expect(parseMonthKey("2026-13")).toEqual({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });
  });

  it("falls back to current month for bad input", () => {
    const now = new Date();
    expect(parseMonthKey("bogus")).toEqual({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });
  });

  it("falls back when undefined", () => {
    const now = new Date();
    expect(parseMonthKey(undefined)).toEqual({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });
  });
});

describe("formatMonthKey", () => {
  it("zero-pads month", () => {
    expect(formatMonthKey({ year: 2026, month: 3 })).toBe("2026-03");
  });
});

describe("addMonths", () => {
  it("advances across year boundary", () => {
    expect(addMonths({ year: 2026, month: 11 }, 3)).toEqual({
      year: 2027,
      month: 2,
    });
  });

  it("rolls backwards", () => {
    expect(addMonths({ year: 2026, month: 2 }, -4)).toEqual({
      year: 2025,
      month: 10,
    });
  });

  it("no-op for delta 0", () => {
    expect(addMonths({ year: 2026, month: 4 }, 0)).toEqual({
      year: 2026,
      month: 4,
    });
  });
});

describe("buildMonthGrid", () => {
  it("returns 42 cells", () => {
    expect(buildMonthGrid({ year: 2026, month: 4 })).toHaveLength(42);
  });

  it("starts on Monday of the week containing the 1st", () => {
    // April 2026: 1st is Wednesday → grid should start on Monday 2026-03-30
    const grid = buildMonthGrid({ year: 2026, month: 4 });
    expect(grid[0].date).toBe("2026-03-30");
    expect(grid[0].outside).toBe(true);
  });

  it("marks days inside the target month as not outside", () => {
    const grid = buildMonthGrid({ year: 2026, month: 4 });
    const first = grid.find((c) => c.date === "2026-04-01");
    expect(first?.outside).toBe(false);
    const last = grid.find((c) => c.date === "2026-04-30");
    expect(last?.outside).toBe(false);
  });

  it("marks trailing padding as outside", () => {
    const grid = buildMonthGrid({ year: 2026, month: 4 });
    const trailing = grid[grid.length - 1];
    // 42 cells - 30 days April = 12 leading + trailing ≠ 0
    expect(trailing.outside).toBe(true);
    expect(trailing.date.startsWith("2026-05")).toBe(true);
  });

  it("handles Mondays-first for months starting on Monday", () => {
    // June 2026: 1st is Monday → leading pad = 0
    const grid = buildMonthGrid({ year: 2026, month: 6 });
    expect(grid[0].date).toBe("2026-06-01");
    expect(grid[0].outside).toBe(false);
  });
});

describe("monthRangeISO", () => {
  it("bounds span from first grid day 00:00 to last grid day 23:59", () => {
    const r = monthRangeISO({ year: 2026, month: 4 });
    expect(r.startISO.startsWith("2026-03-30")).toBe(true);
    // Last cell is 2026-05-10 (Sunday)
    expect(r.endISO.startsWith("2026-05-10")).toBe(true);
  });
});
