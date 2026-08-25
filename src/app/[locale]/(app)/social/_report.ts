/**
 * Loading the closed month, for both the studio's report and the client's.
 *
 * The two screens read the same numbers through different RLS paths — staff via
 * `has_client_access`, the client via `owns_portal_client` (migration 023) — so
 * the query is written once and the caller supplies the client scope.
 */

import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";
import { env } from "@/lib/env";
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

/**
 * What the report knows about its own numbers.
 *
 * `ok` — snapshots were read for this period.
 * `none` — the read succeeded and there is nothing to show: no post tracked
 *   yet, or the collector has not run for these posts.
 * `unavailable` — the read failed, or the metrics integration is not
 *   connected at all, so no collection can have happened.
 *
 * The distinction is the whole point. Collapsing all three into zeros is how
 * a client came to be shown a month that "reached 0 people".
 */
export type MetricsStatus = "ok" | "none" | "unavailable";

export interface MonthReport {
  /** Whether the headline numbers mean anything. */
  metrics: MetricsStatus;
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
): Promise<{ kpis: AggregatedKpis; status: MetricsStatus }> {
  if (clientIds.length === 0) {
    return { kpis: aggregateKpis([]), status: "none" as const };
  }

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
  // A failed RPC used to return aggregateKpis([]) — zeros, indistinguishable
  // from a real month that reached nobody. The report then rendered them as
  // five confident tiles with delta arrows, and the portal showed them to the
  // paying client under the line "the numbers above are live either way".
  if (error) {
    log.error("social.report", "kpi_rpc_failed", { code: error.code ?? "unknown" });
    return { kpis: aggregateKpis([]), status: "unavailable" as const };
  }

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
  // No snapshots is not zero reach. It means nothing was collected for this
  // period — no posts tracked yet, or the collector never ran.
  return {
    kpis: aggregateKpis(latest),
    status: latest.length ? ("ok" as const) : ("none" as const),
  };
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
      metrics: "none",
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

  // Unavailable beats none: if the integration is not configured, the
  // collector returns 503 and writes nothing, so an empty result is explained
  // by that rather than by a quiet month.
  const metrics: MetricsStatus = !env.meta.ok
    ? "unavailable"
    : kpis.status;

  const rows = reportRows ?? [];
  const narrative =
    rows.length === 1 ? readNarrative(rows[0].content) : null;

  return {
    metrics,
    month,
    kpis: kpis.kpis,
    deltas: {
      impressions: delta(kpis.kpis.impressions, prevKpis.kpis.impressions),
      reach: delta(kpis.kpis.reach, prevKpis.kpis.reach),
      interactions: delta(interactionsOf(kpis.kpis), interactionsOf(prevKpis.kpis)),
      keeps: delta(keepsOf(kpis.kpis), keepsOf(prevKpis.kpis)),
      published: delta(pieces.length, prevPieces.length),
    },
    axes: axisDistribution(pieces),
    published: pieces.length,
    narrative,
    awaitingNarrative: rows.length === 0,
  };
}
