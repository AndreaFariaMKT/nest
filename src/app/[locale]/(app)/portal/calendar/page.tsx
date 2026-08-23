import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/client-portal";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import {
  CLIENT_VISIBLE_STAGES,
  STAGE_TONE,
  todayIso,
  type SocialStage,
} from "@/lib/social";
import { NotLinked } from "../_NotLinked";

export const dynamic = "force-dynamic";

/** Same chips the studio's calendar uses, so both sides read alike. */
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
];

type Piece = {
  id: string;
  title: string;
  status: SocialStage;
  publish_on: string | null;
  publish_time: string;
};

/**
 * When things publish — which is what a client opening "Calendar" is asking.
 * This page used to be a copy of the meetings list, so it showed the same
 * meetings twice and never a single publication date.
 */
export default async function PortalCalendar({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, ts, format, client, sp] = await Promise.all([
    getTranslations("portal"),
    getTranslations("social"),
    getFormatter(),
    getPortalClient(),
    searchParams,
  ]);
  if (!client) return <NotLinked message={t("notLinked")} />;

  const today = todayIso();
  const rawMonth = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const month = /^\d{4}-\d{2}$/.test(rawMonth ?? "")
    ? rawMonth!
    : today.slice(0, 7);
  const [year, mon] = month.split("-").map((n) => Number.parseInt(n, 10));

  // Exclusive upper bound on the first of the next month. The obvious
  // `lte(..., "${month}-31")` is a date literal Postgres rejects outright in
  // February, April, June, September and November — PostgREST answers 400,
  // `data` comes back null, and `?? []` turns that into an empty calendar for
  // five months of the year with no error anywhere.
  const nextMonth = (() => {
    const d = new Date(Date.UTC(year, mon, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  })();

  const supabase = await createClient();
  const [{ data: pieceData }, { data: meetingData }] = await Promise.all([
    supabase
      .from("content_drafts")
      .select("id, title, status, publish_on, publish_time")
      .eq("engine", "social")
      .eq("client_id", client.id)
      .in("status", CLIENT_VISIBLE_STAGES)
      .not("publish_on", "is", null)
      .gte("publish_on", `${month}-01`)
      .lt("publish_on", `${nextMonth}-01`),
    supabase
      .from("meetings")
      .select("id, title, starts_at")
      .eq("client_id", client.id)
      .neq("status", "cancelled")
      .gte("starts_at", `${month}-01T00:00:00Z`)
      .lt("starts_at", `${nextMonth}-01T00:00:00Z`),
  ]);

  const pieces = (pieceData ?? []) as Piece[];
  const meetings = (meetingData ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    // Meetings are timestamps; the calendar is days.
    day: m.starts_at.slice(0, 10),
  }));

  const first = new Date(Date.UTC(year, mon - 1, 1));
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, mon - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const link = (m: string) => `/portal/calendar?m=${m}` as Route;

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
        subtitle={ts("calendar.subtitle", {
          month: monthLabel,
          n: pieces.length,
        })}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {LEGEND.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-sm", CHIP[STAGE_TONE[s]])} />
              {ts(`stage.${s}`)}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-border bg-background" />
            {t("meetings.title")}
          </span>
        </div>
        <div className="flex gap-2">
          <Link
            href={link(shift(-1))}
            aria-label={ts("report.previousMonth")}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ←
          </Link>
          <Link
            href={link(today.slice(0, 7))}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ts("calendar.today")}
          </Link>
          <Link
            href={link(shift(1))}
            aria-label={ts("report.nextMonth")}
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
          const isToday = iso === today;
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
                {pieces
                  .filter((p) => p.publish_on === iso)
                  .map((p) => (
                    <span
                      key={p.id}
                      title={`${p.publish_time.slice(0, 5)} · ${p.title}`}
                      className={cn(
                        "block truncate rounded px-1.5 py-1 text-[10px] leading-tight",
                        CHIP[STAGE_TONE[p.status]],
                      )}
                    >
                      {p.title}
                    </span>
                  ))}
                {meetings
                  .filter((m) => m.day === iso)
                  .map((m) => (
                    <span
                      key={m.id}
                      title={m.title}
                      className="block truncate rounded border border-border bg-background px-1.5 py-1 text-[10px] leading-tight"
                    >
                      {m.title}
                    </span>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
