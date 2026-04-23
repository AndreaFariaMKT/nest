import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import type { Database, MeetingStatus } from "@/types/database";
import {
  addMonths,
  buildMonthGrid,
  formatMonthKey,
  monthRangeISO,
  parseMonthKey,
} from "@/lib/calendar";

type Meeting = Pick<
  Database["public"]["Tables"]["meetings"]["Row"],
  "id" | "title" | "starts_at" | "status" | "client_id"
>;

function statusDotColor(s: MeetingStatus): string {
  if (s === "completed") return "bg-emerald-500";
  if (s === "cancelled") return "bg-destructive/60";
  return "bg-primary";
}

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
  const { data: meetingsData } = await supabase
    .from("meetings")
    .select("id, title, starts_at, status, client_id")
    .gte("starts_at", range.startISO)
    .lte("starts_at", range.endISO)
    .order("starts_at", { ascending: true });
  const meetings = (meetingsData ?? []) as Meeting[];

  // Bucket meetings by YYYY-MM-DD in the local timezone for cell lookup.
  const byDay = new Map<string, Meeting[]>();
  for (const m of meetings) {
    const d = new Date(m.starts_at);
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const bucket = `${y}-${mm}-${dd}`;
    const list = byDay.get(bucket) ?? [];
    list.push(m);
    byDay.set(bucket, list);
  }

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(key.year, key.month - 1, 1));

  const prev = formatMonthKey(addMonths(key, -1));
  const next = formatMonthKey(addMonths(key, 1));
  const todayISO = new Date();
  const todayKey = `${todayISO.getFullYear()}-${String(todayISO.getMonth() + 1).padStart(2, "0")}-${String(todayISO.getDate()).padStart(2, "0")}`;

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

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="bg-card px-2 py-1.5 text-center text-xs uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
        {grid.map((cell) => {
          const dayMeetings = byDay.get(cell.date) ?? [];
          const isToday = cell.date === todayKey;
          return (
            <div
              key={cell.date}
              className={`min-h-[90px] bg-background p-2 ${
                cell.outside ? "text-muted-foreground/60" : "text-foreground"
              }`}
              data-testid="calendar-cell"
              data-date={cell.date}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`text-xs font-medium ${
                    isToday
                      ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      : ""
                  }`}
                >
                  {cell.dayOfMonth}
                </span>
              </div>
              <ul className="space-y-1">
                {dayMeetings.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/meetings/${m.id}`}
                      className="flex items-center gap-1.5 truncate rounded-sm px-1 py-0.5 text-xs hover:bg-muted"
                      data-testid="calendar-meeting"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotColor(m.status)}`}
                      />
                      <span className="truncate">{m.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
