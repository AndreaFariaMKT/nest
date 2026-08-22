/**
 * Social media module · the closed month.
 *
 * Pure, like src/lib/social.ts. The report answers two different questions and
 * it matters that they stay separate:
 *
 *   - The numbers say how far the month reached. They come from `post_metrics`
 *     and are aggregated by src/lib/kpi.ts.
 *   - The axis distribution says whether the month stayed on the territory the
 *     brand is trying to own. A win outside the territory is a problem dressed
 *     as a result, so this is the half that decides whether the month was good.
 *
 * The narrative panels (what to keep, adjust, test) come from a stored
 * `monthly_reports` row when one has been generated; the screen is honest about
 * their absence rather than inventing them.
 */

// ───────────────────────────────────────────────────────────────────────────
// Periods
// ───────────────────────────────────────────────────────────────────────────

export interface ReportMonth {
  year: number;
  month: number;
  /** YYYY-MM, the shape the URL carries. */
  key: string;
  /** First instant of the month, ISO — inclusive. */
  fromIso: string;
  /** First instant of the next month, ISO — exclusive. */
  toIso: string;
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export function monthOf(year: number, month: number): ReportMonth {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return {
    year,
    month,
    key: `${year}-${String(month).padStart(2, "0")}`,
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
  };
}

/**
 * The month a report is about. Defaults to the LAST closed month, not the
 * current one — the studio's rule is that the report goes out between the 3rd
 * and the 7th, about the month that just ended.
 */
export function resolveMonth(
  raw: string | null | undefined,
  today: string,
): ReportMonth {
  if (raw && MONTH_KEY.test(raw)) {
    const [y, m] = raw.split("-").map((n) => Number.parseInt(n, 10));
    return monthOf(y, m);
  }
  const [y, m] = today.split("-").map((n) => Number.parseInt(n, 10));
  return m === 1 ? monthOf(y - 1, 12) : monthOf(y, m - 1);
}

export function shiftMonth(m: ReportMonth, delta: number): ReportMonth {
  const d = new Date(Date.UTC(m.year, m.month - 1 + delta, 1));
  return monthOf(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

/** The month before this one — what every number is compared against. */
export function previousMonth(m: ReportMonth): ReportMonth {
  return shiftMonth(m, -1);
}

// ───────────────────────────────────────────────────────────────────────────
// Where the month went
// ───────────────────────────────────────────────────────────────────────────

export interface AxisSlice {
  /** Null pillar becomes an explicit "unassigned" bucket rather than vanishing. */
  axis: string | null;
  count: number;
}

/**
 * How the month's published pieces split across axes, largest first. Ties keep
 * a stable alphabetical order so the chart does not reshuffle between renders.
 */
export function axisDistribution(
  pieces: { pillar: string | null }[],
): AxisSlice[] {
  const counts = new Map<string | null, number>();
  for (const p of pieces) {
    const key = p.pillar?.trim() || null;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts, ([axis, count]) => ({ axis, count })).sort(
    (a, b) =>
      b.count - a.count || (a.axis ?? "￿").localeCompare(b.axis ?? "￿"),
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Movement
// ───────────────────────────────────────────────────────────────────────────

export interface Delta {
  current: number;
  previous: number;
  /** Whole-percent change, or null when there is nothing to compare against. */
  percent: number | null;
  direction: "up" | "down" | "flat";
}

/**
 * A number against last month's. Growth from zero has no percentage — saying
 * "+100%" or "+∞" about the first post of a client's life is noise, so the
 * screen shows the raw pair instead.
 */
export function delta(current: number, previous: number): Delta {
  const direction =
    current > previous ? "up" : current < previous ? "down" : "flat";
  if (previous === 0) return { current, previous, percent: null, direction };
  return {
    current,
    previous,
    percent: Math.round(((current - previous) / previous) * 100),
    direction,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// The stored narrative
// ───────────────────────────────────────────────────────────────────────────

export interface ReportNarrative {
  summary: string;
  highlights: string[];
  lessons: string[];
  nextPillars: string[];
}

/**
 * `monthly_reports.content` is jsonb written by the generator, so it is shaped
 * by whatever the model returned that day. Read it defensively: a malformed row
 * should leave the panel empty, never break the page.
 */
export function readNarrative(content: unknown): ReportNarrative | null {
  if (!content || typeof content !== "object") return null;
  const c = content as Record<string, unknown>;
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const summary = typeof c.summary === "string" ? c.summary : "";
  const narrative: ReportNarrative = {
    summary,
    highlights: list(c.highlights),
    lessons: list(c.lessons),
    nextPillars: list(c.nextPillars),
  };
  const empty =
    !narrative.summary &&
    !narrative.highlights.length &&
    !narrative.lessons.length &&
    !narrative.nextPillars.length;
  return empty ? null : narrative;
}
