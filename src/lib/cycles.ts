// Pure helpers for monthly cycles. I/O-free.

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
  today: string = new Date().toISOString().slice(0, 10),
): boolean {
  return today >= bounds.startsOn && today <= bounds.endsOn;
}

export function daysRemainingInCycle(
  bounds: Pick<CycleBounds, "endsOn">,
  today: string = new Date().toISOString().slice(0, 10),
): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const end = Date.parse(`${bounds.endsOn}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(end) || Number.isNaN(now)) return 0;
  const diff = Math.round((end - now) / msPerDay);
  return Math.max(0, diff);
}
