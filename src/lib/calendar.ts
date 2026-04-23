// Pure month-grid helpers. The calendar view renders a 6×7 grid aligned to
// Monday (ISO weekday 1) — the full grid always shows 42 cells so the layout
// doesn't jump between months. Days from the previous/next month are marked
// as "outside" so the UI can render them muted.

export type MonthKey = { year: number; month: number };

export type DayCell = {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  outside: boolean; // true when the cell belongs to the adjacent month
};

export function parseMonthKey(raw: string | undefined): MonthKey {
  const now = new Date();
  const fallback = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
  if (!raw) return fallback;
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return fallback;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (!Number.isFinite(year) || month < 1 || month > 12) return fallback;
  return { year, month };
}

export function formatMonthKey(k: MonthKey): string {
  return `${k.year}-${String(k.month).padStart(2, "0")}`;
}

export function addMonths(k: MonthKey, delta: number): MonthKey {
  const zeroIndexed = k.month - 1 + delta;
  const year = k.year + Math.floor(zeroIndexed / 12);
  const month = ((zeroIndexed % 12) + 12) % 12 + 1;
  return { year, month };
}

// ISO-like weekday: Monday=1 .. Sunday=7. We shift JS's (Sunday=0, Monday=1)
// so the grid is Mon-first, which Andréa's team reads as "week view".
function isoWeekday(date: Date): number {
  const jsDay = date.getDay(); // 0 = Sunday
  return jsDay === 0 ? 7 : jsDay;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Build a 6×7 (42-cell) Monday-first grid that covers `key.month` plus
 * padding days from the adjacent months.
 */
export function buildMonthGrid(key: MonthKey): DayCell[] {
  const first = new Date(key.year, key.month - 1, 1);
  const leadingPad = isoWeekday(first) - 1; // 0..6 days from previous month

  const cells: DayCell[] = [];
  const start = new Date(first);
  start.setDate(start.getDate() - leadingPad);

  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: toISODate(d),
      dayOfMonth: d.getDate(),
      outside: d.getMonth() + 1 !== key.month,
    });
  }
  return cells;
}

export function monthRangeISO(key: MonthKey): {
  startISO: string;
  endISO: string;
} {
  // Inclusive range covering the whole grid — spans leading/trailing padding.
  // Produced as UTC ISO strings to stay timezone-independent (tests + query
  // comparison against `timestamptz` columns both work without tz drama).
  const grid = buildMonthGrid(key);
  return {
    startISO: `${grid[0].date}T00:00:00.000Z`,
    endISO: `${grid[grid.length - 1].date}T23:59:59.999Z`,
  };
}
