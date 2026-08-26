// Pure helpers for monthly cycles. I/O-free.
//
// The `today` defaults are the studio's calendar day, not UTC's. They used to
// be `new Date().toISOString().slice(0, 10)`, which after 21:00 in São Paulo
// is already tomorrow — so a cycle ending on the 31st read as over, and the
// days remaining were off by one, for the last three hours of every day.

import { todayIso } from "@/lib/social";

export type CycleBounds = {
  year: number;
  month: number; // 1–12
  startsOn: string; // YYYY-MM-DD
  endsOn: string; // YYYY-MM-DD
};

export function currentYearMonth(now: Date = new Date()): {
  year: number;
  month: number;
} {
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };
}

export function cycleBounds(year: number, month: number): CycleBounds {
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error("cycleBounds: year and month must be integers");
  }
  if (month < 1 || month > 12) {
    throw new Error("cycleBounds: month must be 1-12");
  }
  const starts = new Date(Date.UTC(year, month - 1, 1));
  // Day 0 of the next month = last day of this month
  const ends = new Date(Date.UTC(year, month, 0));
  return {
    year,
    month,
    startsOn: starts.toISOString().slice(0, 10),
    endsOn: ends.toISOString().slice(0, 10),
  };
}

export function isCycleActive(
  bounds: Pick<CycleBounds, "startsOn" | "endsOn">,
  today: string = todayIso(),
): boolean {
  return today >= bounds.startsOn && today <= bounds.endsOn;
}

export function daysRemainingInCycle(
  bounds: Pick<CycleBounds, "endsOn">,
  today: string = todayIso(),
): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const end = Date.parse(`${bounds.endsOn}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(end) || Number.isNaN(now)) return 0;
  const diff = Math.round((end - now) / msPerDay);
  return Math.max(0, diff);
}
