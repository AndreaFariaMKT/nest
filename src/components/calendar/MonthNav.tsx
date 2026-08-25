import { Link } from "@/i18n/routing";
import type { Route } from "next";

/**
 * Previous · today · next, and the legend beside it.
 *
 * Written out twice before — same three buttons, same classes, same aria
 * labels, in the studio's calendar and the client's.
 */
export function MonthNav({
  previousHref,
  todayHref,
  nextHref,
  previousLabel,
  todayLabel,
  nextLabel,
  legend,
}: {
  previousHref: string;
  todayHref: string;
  nextHref: string;
  previousLabel: string;
  todayLabel: string;
  nextLabel: string;
  legend: React.ReactNode;
}) {
  const button =
    "inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {legend}
      </div>
      <div className="flex gap-2">
        <Link
          href={previousHref as Route}
          aria-label={previousLabel}
          className={button}
        >
          ←
        </Link>
        <Link href={todayHref as Route} className={button}>
          {todayLabel}
        </Link>
        <Link href={nextHref as Route} aria-label={nextLabel} className={button}>
          →
        </Link>
      </div>
    </div>
  );
}

export {
  shiftMonth,
  monthFromParam,
} from "@/components/calendar/month";
