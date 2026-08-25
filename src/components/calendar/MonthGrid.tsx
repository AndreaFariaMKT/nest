import { getFormatter } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { cn } from "@/lib/utils";
import { CHIP, type CalendarEvent } from "@/components/calendar/month";

export { CHIP, type CalendarEvent } from "@/components/calendar/month";

function chipClass(e: CalendarEvent): string {
  return e.outline
    ? "border border-border bg-background text-foreground"
    : CHIP[e.tone];
}

/**
 * A month, as a grid on a desktop and as an agenda on a phone.
 *
 * Seven columns at 375px is fifty pixels a day, which fits neither a date nor
 * a title. The grid used to be shown at every width and pushed the whole page
 * sideways; then it scrolled inside itself, which stopped the damage without
 * making the month readable. Below `md` it is a list of the days that actually
 * have something on them — which is what anyone wants from a calendar on a
 * phone, and it is why this is worth writing once instead of twice.
 */
export async function MonthGrid({
  month,
  today,
  events,
  emptyLabel,
}: {
  /** YYYY-MM. */
  month: string;
  /** YYYY-MM-DD in the studio's calendar. */
  today: string;
  events: CalendarEvent[];
  /** Shown on the agenda when the month holds nothing. */
  emptyLabel: string;
}) {
  const format = await getFormatter();
  const [year, mon] = month.split("-").map((n) => Number.parseInt(n, 10));

  const first = new Date(Date.UTC(year, mon - 1, 1));
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  // Monday-first.
  const lead = (first.getUTCDay() + 6) % 7;

  const weekdays = Array.from({ length: 7 }, (_, i) =>
    format.dateTime(new Date(Date.UTC(2024, 0, 1 + i)), {
      weekday: "short",
      timeZone: "UTC",
    }),
  );

  const dayIso = (day: number) =>
    `${month}-${String(day).padStart(2, "0")}`;
  const on = (iso: string) => events.filter((e) => e.day === iso);

  const chip = (e: CalendarEvent, className: string) => {
    const body = (
      <>
        {e.label}
      </>
    );
    return e.href ? (
      <Link
        key={e.id}
        href={e.href as Route}
        title={e.title}
        className={cn(className, chipClass(e), "hover:opacity-80")}
      >
        {body}
      </Link>
    ) : (
      <span
        key={e.id}
        title={e.title}
        className={cn(className, chipClass(e))}
      >
        {body}
      </span>
    );
  };

  const withEvents = Array.from({ length: days }, (_, i) => i + 1).filter(
    (day) => on(dayIso(day)).length > 0,
  );

  return (
    <>
      {/* Phone: only the days that have something, in order. */}
      <ul className="space-y-2 md:hidden">
        {withEvents.length === 0 ? (
          <li className="rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </li>
        ) : (
          withEvents.map((day) => {
            const iso = dayIso(day);
            return (
              <li
                key={iso}
                className={cn(
                  "rounded-lg border px-3 py-2.5",
                  iso === today ? "border-brand bg-muted/40" : "border-border",
                )}
              >
                <p
                  className={cn(
                    "mb-1.5 text-xs font-medium",
                    iso === today ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  {format.dateTime(new Date(`${iso}T12:00:00Z`), {
                    weekday: "long",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </p>
                <div className="space-y-1">
                  {on(iso).map((e) =>
                    chip(e, "block rounded px-2 py-1.5 text-xs leading-snug"),
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>

      {/* Desktop: the month. */}
      <div className="hidden grid-cols-7 gap-1.5 md:grid">
        {weekdays.map((w) => (
          <div
            key={w}
            className="py-1 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
          >
            {w}
          </div>
        ))}

        {Array.from({ length: lead }, (_, i) => (
          <div
            key={`lead-${i}`}
            className="min-h-[96px] rounded-lg bg-muted/40"
          />
        ))}

        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const iso = dayIso(day);
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
                {on(iso).map((e) =>
                  chip(
                    e,
                    "block truncate rounded px-1.5 py-1 text-[10px] leading-tight",
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
