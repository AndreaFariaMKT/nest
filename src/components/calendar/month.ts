import type { STAGE_TONE } from "@/lib/social";

/**
 * The calendar's vocabulary: chip colours and month arithmetic.
 *
 * Plain .ts, no JSX, so a unit test can reach it — the same reason the role
 * vocabulary had to leave roles.ts. A table nothing can test is a table that
 * drifts, and this one had already been copied into two calendars.
 */

export type StageTone = (typeof STAGE_TONE)[keyof typeof STAGE_TONE];

/** Event chip colour, keyed off the tone table the pills already use. */
export const CHIP: Record<StageTone, string> = {
  muted: "bg-muted text-muted-foreground",
  brand: "bg-brand-soft text-brand-soft-foreground",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-destructive/15 text-destructive",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export interface CalendarEvent {
  id: string;
  /** YYYY-MM-DD. */
  day: string;
  label: string;
  /** Hover text — usually "<client> · <title>". */
  title?: string;
  tone: StageTone;
  /** Absent for things that are not openable, like a meeting on the portal. */
  href?: string;
  /** Drawn as an outline rather than a filled chip. */
  outline?: boolean;
}

/** The month `delta` steps from a YYYY-MM. */
export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map((n) => Number.parseInt(n, 10));
  const d = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * The month a page should show.
 *
 * `?m=` reaches these pages from the query string, so it is whatever someone
 * typed; anything malformed falls back to the month containing `today` rather
 * than going into Date.UTC as NaN.
 */
export function monthFromParam(
  raw: string | string[] | undefined,
  today: string,
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return /^\d{4}-\d{2}$/.test(value ?? "") ? value! : today.slice(0, 7);
}
