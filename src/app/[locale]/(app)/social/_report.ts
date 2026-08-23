/**
 * Loading the closed month, for both the studio's report and the client's.
 *
 * The two screens read the same numbers through different RLS paths — staff via
 * `has_client_access`, the client via `owns_portal_client` (migration 023) — so
 * the query is written once and the caller supplies the client scope.
 */

import { createClient } from "@/lib/supabase/server";
import {
  aggregateKpis,
  type AggregatedKpis,
  type MetricSnapshot,
} from "@/lib/kpi";
import {
  axisDistribution,
  delta,
  previousMonth,
  readNarrative,
  type AxisSlice,
  type Delta,
  type ReportMonth,
  type ReportNarrative,
} from "@/lib/social-report";

export interface MonthReport {
  month: ReportMonth;
  kpis: AggregatedKpis;
  /** Each headline number against the same number last month. */
  deltas: {
    impressions: Delta;
    reach: Delta;
    interactions: Delta;
    keeps: Delta;
    published: Delta;
  };
  axes: AxisSlice[];
  published: number;
  narrative: ReportNarrative | null;
  /** True when the studio has not generated a narrative for this month yet. */
  awaitingNarrative: boolean;
}

/** Likes + comments — the cheap signals. */
const interactionsOf = (k: AggregatedKpis) => k.likes + k.comments;
/** Saves + shares — the ones that mean someone will come back to it. */
const keepsOf = (k: AggregatedKpis) => k.saves + k.shares;

async function kpisFor(
  clientIds: string[],
  month: ReportMonth,
): Promise<AggregatedKpis> {
  if (clientIds.length === 0) return aggregateKpis([]);

  // One row per post, picked by DISTINCT ON in migration 027 — not one row per
  // post per day reduced here. The old shape asked for `.limit(2000)`, which
  // PostgREST silently served as 1000, and a month of ~34 tracked posts
  // already writes more snapshots than that. Posts whose snapshots fell early
  // in the month dropped out of the totals with nothing reporting it.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("social_month_kpis", {
    target_clients: clientIds,
    from_ts: month.fromIso,
    to_ts: month.toIso,
  });
  if (error) return aggregateKpis([]);

  const latest: MetricSnapshot[] = (data ?? []).map((r) => ({
    publishedPostId: r.published_post_id,
    capturedAt: r.captured_at,
    reach: r.reach,
    impressions: r.impressions,
    likes: r.likes,
    comments: r.comments,
    saves: r.saves,
    shares: r.shares,
  }));
  return aggregateKpis(latest);
}

/** The pieces that actually went live inside the month. */
async function publishedIn(
  clientIds: string[],
  month: ReportMonth,
): Promise<{ pillar: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_drafts")
    .select("pillar, published_at")
    .in("client_id", clientIds)
    // Social pieces only — the pillar mix, which would otherwise count content-engine drafts.
    .eq("engine", "social")
    .eq("status", "published")
    .gte("published_at", month.fromIso)
    .lt("published_at", month.toIso);
  return (data ?? []).map((d) => ({ pillar: d.pillar }));
}

export async function loadMonthReport(
  clientIds: string[],
  month: ReportMonth,
): Promise<MonthReport> {
  const prev = previousMonth(month);

  if (!clientIds.length) {
    const empty = aggregateKpis([]);
    return {
      month,
      kpis: empty,
      deltas: {
        impressions: delta(0, 0),
        reach: delta(0, 0),
        interactions: delta(0, 0),
        keeps: delta(0, 0),
        published: delta(0, 0),
      },
      axes: [],
      published: 0,
      narrative: null,
      awaitingNarrative: true,
    };
  }

  const supabase = await createClient();
  const [kpis, prevKpis, pieces, prevPieces, { data: reportRows }] =
    await Promise.all([
      kpisFor(clientIds, month),
      kpisFor(clientIds, prev),
      publishedIn(clientIds, month),
      publishedIn(clientIds, prev),
      // One narrative per client per month; a studio-wide view shows the single
      // client's when it is the only one in scope, and none otherwise.
      supabase
        .from("monthly_reports")
        .select("content")
        .in("client_id", clientIds)
        .eq("year", month.year)
        .eq("month", month.month)
        .limit(2),
    ]);

  const rows = reportRows ?? [];
  const narrative =
    rows.length === 1 ? readNarrative(rows[0].content) : null;

  return {
    month,
    kpis,
    deltas: {
      impressions: delta(kpis.impressions, prevKpis.impressions),
      reach: delta(kpis.reach, prevKpis.reach),
      interactions: delta(interactionsOf(kpis), interactionsOf(prevKpis)),
      keeps: delta(keepsOf(kpis), keepsOf(prevKpis)),
      published: delta(pieces.length, prevPieces.length),
    },
    axes: axisDistribution(pieces),
    published: pieces.length,
    narrative,
    awaitingNarrative: rows.length === 0,
  };
}
