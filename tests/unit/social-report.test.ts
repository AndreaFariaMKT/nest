import { describe, it, expect } from "vitest";

import {
  axisDistribution,
  delta,
  monthOf,
  previousMonth,
  readNarrative,
  resolveMonth,
  shiftMonth,
} from "@/lib/social-report";

describe("which month the report is about", () => {
  it("defaults to the month that just closed, not the current one", () => {
    // The studio's rule is that the report goes out between the 3rd and the
    // 7th, about the month that ended.
    expect(resolveMonth(null, "2026-09-04").key).toBe("2026-08");
  });

  it("crosses the year boundary backwards", () => {
    const m = resolveMonth(undefined, "2026-01-05");
    expect(m.key).toBe("2025-12");
    expect(m.year).toBe(2025);
    expect(m.month).toBe(12);
  });

  it("honours an explicit month from the URL", () => {
    expect(resolveMonth("2026-03", "2026-09-04").key).toBe("2026-03");
  });

  it("ignores junk rather than rendering an empty month", () => {
    expect(resolveMonth("2026-13", "2026-09-04").key).toBe("2026-08");
    expect(resolveMonth("nonsense", "2026-09-04").key).toBe("2026-08");
    expect(resolveMonth("2026-00", "2026-09-04").key).toBe("2026-08");
  });

  it("spans exactly one month, half-open, in the studio's timezone", () => {
    // 03:00Z is midnight in Sao Paulo. These bounds are applied to timestamptz
    // columns, so a UTC month would have counted a piece marked live at 22:00
    // on the 31st into the FOLLOWING month, and left the reported month three
    // hours short. Every other date in the module is already a Sao Paulo day.
    const m = monthOf(2026, 2);
    expect(m.fromIso).toBe("2026-02-01T03:00:00.000Z");
    expect(m.toIso).toBe("2026-03-01T03:00:00.000Z");
  });

  it("handles February in a leap year", () => {
    expect(monthOf(2024, 2).toIso).toBe("2024-03-01T03:00:00.000Z");
  });

  it("covers the last evening of the month, which UTC bounds dropped", () => {
    // 2026-08-31 22:00 in Sao Paulo is 2026-09-01T01:00Z. Under UTC bounds it
    // fell outside August and inside September.
    const aug = monthOf(2026, 8);
    const lastEvening = new Date("2026-09-01T01:00:00.000Z").toISOString();
    expect(lastEvening >= aug.fromIso && lastEvening < aug.toIso).toBe(true);
    expect(lastEvening < monthOf(2026, 9).fromIso).toBe(true);
  });

  it("shifts across year boundaries in both directions", () => {
    expect(shiftMonth(monthOf(2026, 12), 1).key).toBe("2027-01");
    expect(shiftMonth(monthOf(2026, 1), -1).key).toBe("2025-12");
    expect(previousMonth(monthOf(2026, 1)).key).toBe("2025-12");
  });
});

describe("where the month went", () => {
  it("counts pieces per axis, largest first", () => {
    const out = axisDistribution([
      { pillar: "The method" },
      { pillar: "Positioning" },
      { pillar: "The method" },
      { pillar: "The method" },
    ]);
    expect(out).toEqual([
      { axis: "The method", count: 3 },
      { axis: "Positioning", count: 1 },
    ]);
  });

  it("keeps a stable order when counts tie", () => {
    const out = axisDistribution([{ pillar: "Zed" }, { pillar: "Alpha" }]);
    expect(out.map((a) => a.axis)).toEqual(["Alpha", "Zed"]);
  });

  it("gives pieces with no axis their own bucket instead of dropping them", () => {
    const out = axisDistribution([
      { pillar: null },
      { pillar: "   " },
      { pillar: "Market" },
    ]);
    expect(out).toContainEqual({ axis: null, count: 2 });
    expect(out).toContainEqual({ axis: "Market", count: 1 });
  });

  it("is empty for a month with nothing published", () => {
    expect(axisDistribution([])).toEqual([]);
  });
});

describe("movement against last month", () => {
  it("reports a rise and a fall as whole percents", () => {
    expect(delta(150, 100)).toEqual({
      current: 150,
      previous: 100,
      percent: 50,
      direction: "up",
    });
    expect(delta(50, 100).percent).toBe(-50);
    expect(delta(50, 100).direction).toBe("down");
  });

  it("calls an unchanged number flat", () => {
    expect(delta(100, 100).direction).toBe("flat");
    expect(delta(0, 0).direction).toBe("flat");
  });

  it("refuses to invent a percentage when growing from zero", () => {
    // "+100%" or "+∞" about a client's first month is noise, not information.
    const d = delta(40, 0);
    expect(d.percent).toBeNull();
    expect(d.direction).toBe("up");
  });

  it("rounds rather than showing a fraction", () => {
    expect(delta(101, 300).percent).toBe(-66);
  });
});

describe("the stored narrative", () => {
  it("reads a well-formed report", () => {
    const n = readNarrative({
      summary: "A good month.",
      highlights: ["saves up"],
      lessons: ["lead with a claim"],
      nextPillars: ["method", "market"],
    });
    expect(n?.summary).toBe("A good month.");
    expect(n?.nextPillars).toEqual(["method", "market"]);
  });

  it("survives a row the generator shaped differently", () => {
    // `content` is jsonb written by whatever the model returned that day, so a
    // malformed row must empty the panel, never break the page.
    const n = readNarrative({ summary: 42, highlights: "not a list" });
    expect(n).toBeNull();
  });

  it("drops non-string entries instead of rendering holes", () => {
    const n = readNarrative({
      summary: "ok",
      highlights: ["real", 7, null, "also real"],
    });
    expect(n?.highlights).toEqual(["real", "also real"]);
  });

  it("returns null for nothing usable", () => {
    expect(readNarrative(null)).toBeNull();
    expect(readNarrative("a string")).toBeNull();
    expect(readNarrative({})).toBeNull();
    expect(readNarrative({ summary: "", highlights: [] })).toBeNull();
  });
});
