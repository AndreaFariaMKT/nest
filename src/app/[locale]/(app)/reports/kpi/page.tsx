import { env } from "@/lib/env";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Link } from "@/i18n/routing";
import type { Route } from "next";
import {
  aggregateKpis,
  dailyReachSeries,
  latestPerPost,
  parsePeriod,
  toDay,
  type MetricSnapshot,
} from "@/lib/kpi";

type RawMetric = {
  published_post_id: string;
  captured_at: string;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  published_posts: {
    id: string;
    draft_id: string;
    published_at: string;
    content_drafts:
      | { client_id: string; clients: { name: string; slug: string } | null }
      | { client_id: string; clients: { name: string; slug: string } | null }[]
      | null;
  } | null;
};

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function KpiPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string; clientId?: string }>;
}) {
  const { locale } = await params;
  const { from, to, clientId } = await searchParams;
  setRequestLocale(locale);
  const [t, tReports] = await Promise.all([
    getTranslations("reports.kpi"),
    getTranslations("reports"),
  ]);

  const period = parsePeriod(from, to);
  const supabase = await createClient();
  const tenantId = await currentTenantId();

  // Pull every metric snapshot in the period for posts whose draft (and thus
  // client) we can read. RLS handles client scoping; the optional clientId
  // filter narrows further on the join.
  // Paged, not `.limit(2000)`.
  //
  // PostgREST silently serves a limit above its configured maximum as 1000,
  // and post_metrics holds one row per post PER CAPTURE — a month of ~34
  // tracked posts already writes more snapshots than that. Everything past the
  // cap simply vanished: totals under-counted, and the reach series lost its
  // earliest days, with nothing on the screen saying so. The social monthly
  // report was fixed for exactly this in migration 027; this copy was not.
  const PAGE = 1000;
  const MAX_PAGES = 20;
  const rows: RawMetric[] = [];
  let truncated = false;

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
    let query = supabase
      .from("post_metrics")
      .select(
        "published_post_id, captured_at, reach, impressions, likes, comments, saves, shares, published_posts!inner(id, draft_id, published_at, content_drafts!inner(client_id, clients!inner(name, slug)))",
      )
      .eq("tenant_id", tenantId)
      .gte("captured_at", period.fromIso)
      .lt("captured_at", period.toIso)
      .order("captured_at", { ascending: false })
      .range(pageIndex * PAGE, pageIndex * PAGE + PAGE - 1);

    if (clientId) {
      query = query.eq("published_posts.content_drafts.client_id", clientId);
    }

    const { data: pageRows } = await query;
    const batch = (pageRows ?? []) as unknown as RawMetric[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    // Twenty thousand snapshots in one window is not a reporting period, it is
    // a bug upstream. Stop, and say the number is partial rather than
    // presenting it as the whole.
    if (pageIndex === MAX_PAGES - 1) truncated = true;
  }

  const snapshots: MetricSnapshot[] = rows.map((r) => ({
    publishedPostId: r.published_post_id,
    capturedAt: r.captured_at,
    reach: r.reach,
    impressions: r.impressions,
    likes: r.likes,
    comments: r.comments,
    saves: r.saves,
    shares: r.shares,
  }));

  const latest = latestPerPost(snapshots);
  const totals = aggregateKpis(latest);
  const series = dailyReachSeries(snapshots);

  // Client list for the filter dropdown — RLS-scoped.
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  const formatInt = (n: number) => new Intl.NumberFormat(locale).format(n);
  const formatPct = (n: number | null) =>
    n === null ? "—" : `${n.toFixed(2)}%`;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* The mirror of the tab row on /reports. This screen rendered no link
          of any kind, so browser Back was the only way out of it. */}
      <div className="flex gap-2 border-b border-border">
        <Link
          href={"/reports" as Route}
          className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:border-border hover:text-foreground"
        >
          {tReports("monthlyTab")}
        </Link>
        <span className="-mb-px border-b-2 border-foreground px-3 py-2 text-sm font-medium">
          {tReports("kpiTab")}
        </span>
      </div>

      {truncated ? (
        <p
          role="status"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
        >
          {t("truncated")}
        </p>
      ) : null}

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="clientId">
            {t("filterClient")}
          </label>
          <select
            id="clientId"
            name="clientId"
            defaultValue={clientId ?? ""}
            className="h-9 min-w-[200px] rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">{t("filterAll")}</option>
            {(clients ?? []).map((c: { id: string; name: string }) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="from">
            {t("filterFrom")}
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from ?? period.fromIso.slice(0, 10)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="to">
            {t("filterTo")}
          </label>
          <input
            id="to"
            name="to"
            type="date"
            // toDay(), not toIso: the bound is exclusive and sits on the
            // day after, so slicing it showed the person a date they did
            // not choose — and submitting it walked the range forward.
            defaultValue={to ?? toDay(period)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("apply")}
        </button>
      </form>

      {totals.postsCovered === 0 ? (
        <p className="text-sm text-muted-foreground">
          {/* "Wait for the next collector run" is bad advice when the
              collector answers 503 and writes nothing, which is what it does
              with no Instagram connection. */}
          {env.meta.ok ? t("noData") : t("notConnected")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label={t("tiles.reach")} value={formatInt(totals.reach)} />
            <Tile label={t("tiles.impressions")} value={formatInt(totals.impressions)} />
            <Tile
              label={t("tiles.engagementRate")}
              value={formatPct(totals.engagementRate)}
            />
            <Tile label={t("tiles.postsCovered")} value={formatInt(totals.postsCovered)} />
            <Tile label={t("tiles.likes")} value={formatInt(totals.likes)} />
            <Tile label={t("tiles.comments")} value={formatInt(totals.comments)} />
            <Tile label={t("tiles.saves")} value={formatInt(totals.saves)} />
            <Tile label={t("tiles.shares")} value={formatInt(totals.shares)} />
          </div>

          {series.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("sparkline")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Sparkline label={t("sparkline")} points={series} />
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl">{value}</div>
    </div>
  );
}

function Sparkline({
  points,
  label,
}: {
  points: { day: string; reach: number }[];
  /** Read aloud in place of the chart, so it belongs in the dictionary. */
  label: string;
}) {
  const width = 600;
  const height = 80;
  const padding = 4;
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.reach);
  const xMax = Math.max(1, xs.length - 1);
  const yMax = Math.max(1, ...ys);

  const scaleX = (i: number) =>
    padding + (i / xMax) * (width - 2 * padding);
  const scaleY = (v: number) =>
    height - padding - (v / yMax) * (height - 2 * padding);

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(i).toFixed(2)} ${scaleY(p.reach).toFixed(2)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-20 w-full"
      aria-label={label}
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
      {points.map((p, i) => (
        <circle
          key={p.day}
          cx={scaleX(i)}
          cy={scaleY(p.reach)}
          r="2"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
