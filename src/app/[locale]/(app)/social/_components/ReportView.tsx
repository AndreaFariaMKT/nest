import { useTranslations, useFormatter } from "next-intl";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { cn } from "@/lib/utils";
import { shiftMonth, type Delta } from "@/lib/social-report";
import type { MonthReport } from "../_report";

/**
 * The closed month, as the studio reads it and as the client receives it.
 *
 * The numbers say how far it reached; the axis chart says whether it stayed on
 * the territory. Both are shown, because a strong month outside the territory
 * is a problem dressed as a result.
 */
export function ReportView({
  report,
  hrefFor,
}: {
  report: MonthReport;
  /** Builds the link for another month, preserving the caller's own filters. */
  hrefFor: (monthKey: string) => string;
}) {
  const t = useTranslations("social.report");
  const format = useFormatter();
  const { month, kpis, deltas, axes } = report;

  const monthLabel = format.dateTime(
    new Date(Date.UTC(month.year, month.month - 1, 1)),
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  const max = Math.max(1, ...axes.map((a) => a.count));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("closedMonth", { month: monthLabel })}
        </p>
        <div className="flex gap-2">
          <Link
            href={hrefFor(shiftMonth(month, -1).key) as Route}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("previousMonth")}
          >
            ←
          </Link>
          <Link
            href={hrefFor(shiftMonth(month, 1).key) as Route}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("nextMonth")}
          >
            →
          </Link>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label={t("kpi.impressions")} value={kpis.impressions} d={deltas.impressions} />
        <Kpi label={t("kpi.reach")} value={kpis.reach} d={deltas.reach} />
        <Kpi label={t("kpi.interactions")} value={deltas.interactions.current} d={deltas.interactions} />
        <Kpi label={t("kpi.keeps")} value={deltas.keeps.current} d={deltas.keeps} />
        <Kpi label={t("kpi.published")} value={report.published} d={deltas.published} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {t("axisTitle")}
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">{t("axisHint")}</p>

          {axes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("nothingPublished")}
            </p>
          ) : (
            <ul className="space-y-1">
              {axes.map((a) => (
                <li
                  key={a.axis ?? "unassigned"}
                  className="grid grid-cols-[minmax(0,7rem)_1fr_2rem] items-center gap-3 py-1.5"
                >
                  <span className="truncate text-sm">
                    {a.axis ?? t("noAxis")}
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${(a.count / max) * 100}%` }}
                    />
                  </span>
                  <span className="text-right text-sm text-brand">{a.count}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 rounded-xl border-l-2 border-brand bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {t("axisNote")}
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-muted/40 p-5">
          <h2 className="mb-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {t("readingTitle")}
          </h2>

          {report.narrative ? (
            <div className="space-y-3">
              {report.narrative.summary ? (
                <p className="text-sm leading-relaxed">{report.narrative.summary}</p>
              ) : null}
              <Panel title={t("highlights")} items={report.narrative.highlights} />
              <Panel title={t("lessons")} items={report.narrative.lessons} />
              <Panel title={t("nextMonth")} items={report.narrative.nextPillars} />
            </div>
          ) : (
            <p className="py-6 text-sm leading-relaxed text-muted-foreground">
              {report.awaitingNarrative
                ? t("noNarrative")
                : t("narrativePerClient")}
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function Panel({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-brand">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={i}
            className="relative pl-4 text-sm leading-relaxed text-muted-foreground before:absolute before:left-0 before:top-2.5 before:h-px before:w-2 before:bg-brand"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Kpi({
  label,
  value,
  d,
}: {
  label: string;
  value: number;
  d: Delta;
}) {
  const t = useTranslations("social.report");
  const format = useFormatter();
  return (
    <div className="rounded-2xl bg-muted/50 p-4">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl leading-none">
        {format.number(value)}
      </p>
      <p
        className={cn(
          "mt-1.5 text-xs",
          d.direction === "up" && "text-emerald-600",
          d.direction === "down" && "text-destructive",
          d.direction === "flat" && "text-muted-foreground",
        )}
      >
        {d.percent === null
          ? t("previousRaw", { n: format.number(d.previous) })
          : t("previousPercent", {
              sign: d.percent > 0 ? "+" : "",
              percent: d.percent,
              n: format.number(d.previous),
            })}
      </p>
    </div>
  );
}
