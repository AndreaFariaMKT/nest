import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import type { Route } from "next";

import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/client-portal";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import {
  CHIP,
  MonthGrid,
  type CalendarEvent,
} from "@/components/calendar/MonthGrid";
import {
  MonthNav,
  monthFromParam,
  shiftMonth,
} from "@/components/calendar/MonthNav";
import {
  CLIENT_VISIBLE_STAGES,
  STAGE_TONE,
  todayIso,
  type SocialStage,
} from "@/lib/social";
import { NotLinked } from "../_NotLinked";

export const dynamic = "force-dynamic";

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
  const month = monthFromParam(sp.m, today);
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

  const events: CalendarEvent[] = [
    ...pieces.map((p) => ({
      id: p.id,
      day: p.publish_on!,
      // The client's calendar shows what publishes and when; the piece itself
      // is read on /portal/content, where the approval controls live.
      label: `${p.publish_time.slice(0, 5)} · ${p.title}`,
      title: p.title,
      tone: STAGE_TONE[p.status],
    })),
    ...meetings.map((m) => ({
      id: `m-${m.id}`,
      day: m.day,
      label: m.title,
      title: m.title,
      tone: "muted" as const,
      // Outlined rather than tinted: a meeting is not a stage, and giving it
      // one of the stage colours would put it in the legend's vocabulary.
      outline: true,
    })),
  ];

  const link = (m: string) => `/portal/calendar?m=${m}` as Route;

  const monthLabel = format.dateTime(new Date(`${month}-01T12:00:00Z`), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <>
      <PageHeader
        title={t("calendar.title")}
        subtitle={ts("calendar.subtitle", {
          month: monthLabel,
          n: pieces.length,
        })}
      />

      <MonthNav
        previousHref={link(shiftMonth(month, -1))}
        todayHref={link(today.slice(0, 7))}
        nextHref={link(shiftMonth(month, 1))}
        previousLabel={ts("report.previousMonth")}
        todayLabel={ts("calendar.today")}
        nextLabel={ts("report.nextMonth")}
        legend={
          <>
            {LEGEND.map((stage) => (
              <span key={stage} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-sm",
                    CHIP[STAGE_TONE[stage]],
                  )}
                />
                {ts(`stage.${stage}`)}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-border bg-background" />
              {t("meetings.title")}
            </span>
          </>
        }
      />

      <MonthGrid
        month={month}
        today={today}
        events={events}
        emptyLabel={ts("calendar.emptyMonth")}
      />
    </>
  );
}
