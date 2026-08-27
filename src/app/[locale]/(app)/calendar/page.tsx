import { dayOf, todayIso } from "@/lib/social";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import type { Database } from "@/types/database";
import {
  addMonths,
  buildMonthGrid,
  formatMonthKey,
  monthRangeISO,
  parseMonthKey,
} from "@/lib/calendar";
import {
  CalendarGrid,
  type CalendarMeeting,
} from "./_components/CalendarGrid";

type Meeting = Pick<
  Database["public"]["Tables"]["meetings"]["Row"],
  "id" | "title" | "starts_at" | "status" | "client_id"
>;

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("calendar");

  const ymRaw = typeof sp.ym === "string" ? sp.ym : undefined;
  const key = parseMonthKey(ymRaw);
  const grid = buildMonthGrid(key);
  const range = monthRangeISO(key);

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const { data: meetingsData } = await supabase
    .from("meetings")
    .select("id, title, starts_at, status, client_id")
    .eq("tenant_id", tenantId)
    .gte("starts_at", range.startISO)
    .lte("starts_at", range.endISO)
    .order("starts_at", { ascending: true })
    .limit(OPTION_LIST_CAP);
  const meetings = (meetingsData ?? []) as Meeting[];

  // Pre-compute dateKey for each meeting so the client component doesn't
  // have to re-bucket.
  //
  // dayOf(), not getFullYear/getMonth/getDate. Those read the SERVER's zone,
  // which is UTC on Vercel — so a meeting at 21:00 São Paulo landed in the
  // next day's cell, and after 21:00 the "today" highlight moved to tomorrow.
  const calendarMeetings: CalendarMeeting[] = meetings.map((m) => {
    const key = dayOf(m.starts_at) ?? m.starts_at.slice(0, 10);
    const [y, mm, dd] = key.split("-");
    return {
      id: m.id,
      title: m.title,
      starts_at: m.starts_at,
      status: m.status,
      dateKey: `${y}-${mm}-${dd}`,
    };
  });

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(key.year, key.month - 1, 1));

  const prev = formatMonthKey(addMonths(key, -1));
  const next = formatMonthKey(addMonths(key, 1));
  const todayISO = new Date();
  // The studio's day, not the server's: after 21:00 São Paulo the "today"
  // highlight used to move to tomorrow's cell.
  const todayKey = todayIso();

  // Build localized weekday labels (Mon-first).
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const refMonday = new Date(2026, 0, 5); // Jan 5 2026 is a Monday
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(refMonday);
    d.setDate(refMonday.getDate() + i);
    return weekdayFmt.format(d);
  });

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-foreground">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link
          href="/meetings/new"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-testid="calendar-new-meeting"
        >
          {t("newMeeting")}
        </Link>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl capitalize">{monthLabel}</h2>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={{ pathname: "/calendar", query: { ym: prev } }}
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 hover:bg-muted"
            data-testid="calendar-prev"
          >
            ← {t("prev")}
          </Link>
          <Link
            href="/calendar"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 hover:bg-muted"
          >
            {t("today")}
          </Link>
          <Link
            href={{ pathname: "/calendar", query: { ym: next } }}
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 hover:bg-muted"
            data-testid="calendar-next"
          >
            {t("next")} →
          </Link>
        </div>
      </div>

      <CalendarGrid
        locale={locale}
        cells={grid}
        weekdayLabels={weekdayLabels}
        meetings={calendarMeetings}
        todayKey={todayKey}
      />
      <p className="mt-3 text-xs text-muted-foreground">{t("dragHint")}</p>
    </>
  );
}
