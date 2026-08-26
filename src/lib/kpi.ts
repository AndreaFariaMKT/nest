// Pure helpers for the KPI dashboard at /reports/kpi.
//
// The dashboard aggregates `post_metrics` (time-series) into period-level
// totals. Because every cron run inserts a new row even when values haven't
// changed, "total reach" naively summed across all rows would over-count.
// We therefore reduce to one row per (post, day) by taking the latest
// snapshot of that day, and then sum across posts.
//
// Engagement rate convention: (likes + comments + saves + shares) / reach.
// Reported as a percentage (0-100). Returns null when reach is 0 or null.

export type MetricSnapshot = {
  publishedPostId: string;
  capturedAt: string; // ISO
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
};

export type AggregatedKpis = {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  engagementRate: number | null; // 0-100, null when reach is 0
  postsCovered: number;
};

// ───────────────────────────────────────────────────────────────────────────
// Per-post latest snapshot
// ───────────────────────────────────────────────────────────────────────────

/**
 * Reduces snapshots to one row per published_post: the latest captured_at.
 * That row is the canonical "current" metric for the post in the dataset.
 */
export function latestPerPost(rows: MetricSnapshot[]): MetricSnapshot[] {
  const byPost = new Map<string, MetricSnapshot>();
  for (const row of rows) {
    const existing = byPost.get(row.publishedPostId);
    if (!existing || row.capturedAt > existing.capturedAt) {
      byPost.set(row.publishedPostId, row);
    }
  }
  return Array.from(byPost.values());
}

// ───────────────────────────────────────────────────────────────────────────
// Aggregate
// ───────────────────────────────────────────────────────────────────────────

export function aggregateKpis(latest: MetricSnapshot[]): AggregatedKpis {
  let reach = 0;
  let impressions = 0;
  let likes = 0;
  let comments = 0;
  let saves = 0;
  let shares = 0;
  for (const row of latest) {
    reach += row.reach ?? 0;
    impressions += row.impressions ?? 0;
    likes += row.likes ?? 0;
    comments += row.comments ?? 0;
    saves += row.saves ?? 0;
    shares += row.shares ?? 0;
  }
  return {
    reach,
    impressions,
    likes,
    comments,
    saves,
    shares,
    engagementRate: computeEngagementRate({
      likes,
      comments,
      saves,
      shares,
      reach,
    }),
    postsCovered: latest.length,
  };
}

export function computeEngagementRate(input: {
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
}): number | null {
  if (!input.reach || input.reach === 0) return null;
  const interactions =
    input.likes + input.comments + input.saves + input.shares;
  return (interactions / input.reach) * 100;
}

// ───────────────────────────────────────────────────────────────────────────
// Time-series buckets — daily reach for sparkline
// ───────────────────────────────────────────────────────────────────────────

export type DailyReachPoint = { day: string; reach: number };

/**
 * Buckets snapshots by UTC day (YYYY-MM-DD), summing reach across the latest
 * snapshot of each post on that day. Days with zero coverage are not emitted
 * — the caller can pad if they need a contiguous series.
 */
export function dailyReachSeries(rows: MetricSnapshot[]): DailyReachPoint[] {
  // Per-post-per-day latest snapshot.
  const byKey = new Map<string, MetricSnapshot>();
  for (const row of rows) {
    const day = row.capturedAt.slice(0, 10);
    const key = `${row.publishedPostId}::${day}`;
    const existing = byKey.get(key);
    if (!existing || row.capturedAt > existing.capturedAt) {
      byKey.set(key, row);
    }
  }
  // Sum reach by day.
  const byDay = new Map<string, number>();
  for (const row of byKey.values()) {
    const day = row.capturedAt.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + (row.reach ?? 0));
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, reach]) => ({ day, reach }));
}

// ───────────────────────────────────────────────────────────────────────────
// Period parsing — defaults + validation
// ───────────────────────────────────────────────────────────────────────────

export type Period = { fromIso: string; toIso: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Parses ?from=&to= search params with safe defaults (last 30 days).
 *
 * `toIso` is an EXCLUSIVE upper bound set to the end of the chosen day, so a
 * `.lt()` filter includes that whole day. The old docstring claimed both
 * bounds were "normalised to UTC midnight … so day-aligned filtering doesn't
 * drop today" — midnight-of-the-day is precisely what dropped it.
 *
 * `toDay()` gives back the day the person actually picked, for re-filling the
 * form; reading `toIso` for that shows them the day after.
 */
export function parsePeriod(
  fromRaw: string | null | undefined,
  toRaw: string | null | undefined,
  now: Date = new Date(),
): Period {
  const fromDate = isYyyyMmDd(fromRaw)
    ? new Date(`${fromRaw}T00:00:00.000Z`)
    : new Date(now.getTime() - 30 * DAY_MS);
  // The END of the chosen day, not its start. The filter is `.lt(captured_at,
  // toIso)`, so midnight-of-the-day excluded the day the person picked:
  // choosing 1–25 August returned the 1st through the 24th. Worse, the form
  // pre-fills `to` with this same value, so submitting it unchanged shrank the
  // range by a day, every time.
  const toDate = isYyyyMmDd(toRaw)
    ? new Date(`${toRaw}T00:00:00.000Z`)
    : now;
  if (isYyyyMmDd(toRaw)) toDate.setUTCDate(toDate.getUTCDate() + 1);
  return {
    fromIso: fromDate.toISOString(),
    toIso: toDate.toISOString(),
  };
}

/** The inclusive last day of a period, for showing back in a date input. */
export function toDay(period: Period): string {
  const d = new Date(period.toIso);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function isYyyyMmDd(s: string | null | undefined): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
