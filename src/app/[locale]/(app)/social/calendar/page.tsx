import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import { STAGE_TONE, type SocialStage } from "@/lib/social";
import { loadScope } from "../_data";
import { ModuleShell } from "../_components/ModuleShell";

export const dynamic = "force-dynamic";

/** Event chip colour, keyed off the same tone table the pills use. */
const CHIP: Record<(typeof STAGE_TONE)[SocialStage], string> = {
  muted: "bg-muted text-muted-foreground",
  brand: "bg-brand-soft text-brand-soft-foreground",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-destructive/15 text-destructive",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

const LEGEND: SocialStage[] = [
  "published",
  "scheduled",
  "approved",
  "client_review",
  "text_review",
  "draft",
];

export default async function SocialCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, scope, sp] = await Promise.all([
    getTranslations("social"),
    getFormatter(),
    loadScope(searchParams),
    searchParams,
  ]);

  const rawMonth = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const month = /^\d{4}-\d{2}$/.test(rawMonth ?? "")
    ? rawMonth!
    : scope.today.slice(0, 7);
  const [year, mon] = month.split("-").map((n) => Number.parseInt(n, 10));

  const first = new Date(Date.UTC(year, mon - 1, 1));
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  // Monday-first grid.
  const lead = (first.getUTCDay() + 6) % 7;

  const inMonth = scope.pieces.filter((p) => p.publish_on?.startsWith(month));
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, mon - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const link = (m: string) =>
    `/social/calendar?m=${m}${scope.client ? `&client=${scope.client.slug}` : ""}` as Route;

  const monthLabel = format.dateTime(first, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const weekdays = Array.from({ length: 7 }, (_, i) =>
    format.dateTime(new Date(Date.UTC(2024, 0, 1 + i)), {
      weekday: "short",
      timeZone: "UTC",
    }),
  );

  return (
    <>
      <PageHeader
        title={t("calendar.title")}
        subtitle={t("calendar.subtitle", { month: monthLabel, n: inMonth.length })}
      />
      <ModuleShell scope={scope} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {LEGEND.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span
                className={cn("h-2.5 w-2.5 rounded-sm", CHIP[STAGE_TONE[s]])}
              />
              {t(`stage.${s}`)}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Link
            href={link(shift(-1))}
            aria-label={t("report.previousMonth")}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ←
          </Link>
          <Link
            href={link(scope.today.slice(0, 7))}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("calendar.today")}
          </Link>
          <Link
            href={link(shift(1))}
            aria-label={t("report.nextMonth")}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {weekdays.map((w) => (
          <div
            key={w}
            className="py-1 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
          >
            {w}
          </div>
        ))}

        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} className="min-h-[96px] rounded-lg bg-muted/40" />
        ))}

        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const iso = `${month}-${String(day).padStart(2, "0")}`;
          const events = inMonth.filter((p) => p.publish_on === iso);
          const isToday = iso === scope.today;
          return (
            <div
              key={iso}
              className={cn(
                "min-h-[96px] rounded-lg border p-1.5",
                isToday ? "border-brand bg-muted/40" : "border-border",
              )}
            >
              <span
                className={cn(
                  "text-[11px]",
                  isToday ? "font-medium text-brand" : "text-muted-foreground",
                )}
              >
                {day}
              </span>
              <div className="mt-1 space-y-1">
                {events.map((p) => (
                  <Link
                    key={p.id}
                    href={`/social/pieces/${p.id}` as Route}
                    title={`${scope.clientName(p.client_id)} · ${p.title}`}
                    className={cn(
                      "block truncate rounded px-1.5 py-1 text-[10px] leading-tight",
                      CHIP[STAGE_TONE[p.status]],
                    )}
                  >
                    {p.title}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
