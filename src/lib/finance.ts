/**
 * The studio's own money — the derived numbers, kept pure.
 *
 * Everything here is a function of rows in, a number out: no Supabase, no
 * generated types, so the arithmetic that decides whether the studio believes
 * it can make payroll is testable without a database. The same reasoning that
 * put kpi.ts and money.ts in this directory.
 *
 * The distinction the whole module turns on is cash against accrual:
 *
 *   balanço — what moved through the bank      → date_cash
 *   lucro   — what the month actually earned   → date_accrual
 *
 * They are both right and they do not agree. August's invoice paid in
 * September is September's cash and August's revenue.
 */

import { sumCents } from "@/lib/money";

export const CURRENCIES = ["BRL", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Money = { amount_cents: number; currency: string };

export type FxRate = { day: string; base: string; quote: string; rate: number };

/**
 * Convert to BRL cents at a given day's rate.
 *
 * A missing rate returns null rather than falling back to a constant or to
 * 1:1. Both fallbacks produce a number that looks like money and is wrong —
 * silently, on a dashboard, in the direction nobody checks. Null forces the
 * caller to say "sem câmbio" on screen.
 */
export function toBrlCents(
  money: Money,
  rateFor: (day: string) => number | null,
  day: string,
): number | null {
  if (money.currency === "BRL") return money.amount_cents;
  const rate = rateFor(day);
  if (rate === null || !Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(money.amount_cents * rate);
}

/**
 * The most recent rate on or before a day.
 *
 * Weekends and holidays have no quote, and a Saturday receipt still has to be
 * converted — carrying the last known rate forward is what a bank statement
 * does. Rates after the day are never used: that would be hindsight.
 */
export function rateOnOrBefore(
  rates: readonly FxRate[],
  day: string,
  base = "USD",
  quote = "BRL",
): number | null {
  let best: FxRate | null = null;
  for (const r of rates) {
    if (r.base !== base || r.quote !== quote) continue;
    if (r.day > day) continue;
    if (!best || r.day > best.day) best = r;
  }
  return best ? best.rate : null;
}

export type Account = {
  currency: string;
  kind: string;
  balance_cents: number;
};

/**
 * Operating cash, in BRL cents.
 *
 * The reserve is excluded deliberately. It exists in order not to be spent,
 * and folding it in is how a studio believes it has four months of runway when
 * it has one. `reserveBalance` reports it separately, and the two are never
 * added on screen.
 */
export function operatingBalance(
  accounts: readonly Account[],
  rate: number | null,
): number {
  return sumCents(
    accounts
      .filter((a) => a.kind === "operacional")
      .map((a) =>
        a.currency === "BRL"
          ? a.balance_cents
          : rate === null
            ? 0
            : Math.round(a.balance_cents * rate),
      ),
  );
}

export function reserveBalance(
  accounts: readonly Account[],
  rate: number | null,
): number {
  return sumCents(
    accounts
      .filter((a) => a.kind === "reserva")
      .map((a) =>
        a.currency === "BRL"
          ? a.balance_cents
          : rate === null
            ? 0
            : Math.round(a.balance_cents * rate),
      ),
  );
}

/**
 * Capital de giro — what the studio can actually operate on.
 *
 * Cash in the operating accounts, plus what is owed to it, minus what it owes.
 * The reserve is not in it, by the argument above.
 */
export function workingCapital(input: {
  operating_cents: number;
  receivable_cents: number;
  payable_cents: number;
}): number {
  return (
    input.operating_cents + input.receivable_cents - input.payable_cents
  );
}

/**
 * How many months of operating cost a pile of money covers.
 *
 * Returns null rather than Infinity when there is no monthly cost. A studio
 * with no recorded costs has not achieved infinite runway; it has an empty
 * ledger, and "∞ meses" on a dashboard is worse than an em dash.
 */
export function monthsOfRunway(
  cash_cents: number,
  monthly_cost_cents: number,
): number | null {
  if (monthly_cost_cents <= 0) return null;
  return cash_cents / monthly_cost_cents;
}

export type Entry = {
  amount_cents: number;
  /**
   * The row in BRL cents at its own date's rate — 054. Null when no rate was
   * on file, and every aggregation below skips it and counts it rather than
   * treating it as zero.
   *
   * This column exists because the aggregations used to sum `amount_cents`
   * across currencies without reading `currency` at all: a USD 4.110,00
   * receipt added 411000 to the month and rendered as R$ 4.110,00 instead of
   * R$ 22.070,70. An 81% understatement, silent.
   */
  amount_brl_cents: number | null;
  currency: string;
  date_cash: string;
  date_accrual: string;
  category_kind?: string | null;
};

/** Rows that carry a converted amount, and the count of those that do not. */
function converted(rows: readonly Entry[]): {
  rows: Array<Entry & { amount_brl_cents: number }>;
  unconverted: number;
} {
  const ok = rows.filter(
    (e): e is Entry & { amount_brl_cents: number } =>
      e.amount_brl_cents !== null,
  );
  return { rows: ok, unconverted: rows.length - ok.length };
}

/** Rows whose cash date falls in an ISO month ("2026-08"). */
export function inCashMonth(entries: readonly Entry[], month: string): Entry[] {
  return entries.filter((e) => e.date_cash.startsWith(month));
}

/** Rows whose accrual date falls in an ISO month. */
export function inAccrualMonth(
  entries: readonly Entry[],
  month: string,
): Entry[] {
  return entries.filter((e) => e.date_accrual.startsWith(month));
}

/**
 * Cash in and out for a month.
 *
 * Transfers are excluded from both sides. Moving money to the reserve is not
 * spending and moving it back is not income — counted, a month that topped up
 * the reserve reads as the studio's worst month on record.
 */
export function cashFlow(
  entries: readonly Entry[],
  month: string,
): { inflow: number; outflow: number; balance: number; unconverted: number } {
  const { rows, unconverted } = converted(
    inCashMonth(entries, month).filter((e) => e.category_kind !== "transfer"),
  );
  const inflow = sumCents(
    rows.filter((e) => e.amount_brl_cents > 0).map((e) => e.amount_brl_cents),
  );
  const outflow = sumCents(
    rows.filter((e) => e.amount_brl_cents < 0).map((e) => -e.amount_brl_cents),
  );
  return { inflow, outflow, balance: inflow - outflow, unconverted };
}

/**
 * Revenue, cost and profit for a month, on the accrual side — which is the
 * side the accountant works on.
 */
export function monthResult(
  entries: readonly Entry[],
  month: string,
): {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  unconverted: number;
} {
  const { rows, unconverted } = converted(
    inAccrualMonth(entries, month).filter((e) => e.category_kind !== "transfer"),
  );
  const revenue = sumCents(
    rows.filter((e) => e.amount_brl_cents > 0).map((e) => e.amount_brl_cents),
  );
  const cost = sumCents(
    rows.filter((e) => e.amount_brl_cents < 0).map((e) => -e.amount_brl_cents),
  );
  const profit = revenue - cost;
  return {
    revenue,
    cost,
    profit,
    // Percent of revenue. Zero revenue gives a zero margin, not a division by
    // zero — a month with costs and no income has no margin to report.
    margin: revenue === 0 ? 0 : Math.round((profit / revenue) * 100),
    unconverted,
  };
}

export type Openable = {
  amount_cents: number;
  currency: string;
  due_on: string;
  paid_on: string | null;
  status: string;
};

/** Still owed: not paid, not cancelled. */
export function isOpen(row: Openable): boolean {
  return row.paid_on === null && row.status !== "cancelled";
}

/** Open and past its due date, in the studio's calendar. */
export function isOverdue(row: Openable, todayIso: string): boolean {
  return isOpen(row) && row.due_on < todayIso;
}

/**
 * Total still open, in BRL cents.
 *
 * Rows in a currency with no rate available are skipped and reported, rather
 * than silently counted as zero — a receivable that vanishes from the total
 * because nobody entered Tuesday's rate is the kind of error that is only
 * found when the money does not arrive.
 */
export function openTotal(
  rows: readonly Openable[],
  rateFor: (day: string) => number | null,
): { total_cents: number; unconverted: number } {
  let total = 0;
  let unconverted = 0;
  for (const row of rows) {
    if (!isOpen(row)) continue;
    const brl = toBrlCents(row, rateFor, row.due_on);
    if (brl === null) {
      unconverted += 1;
      continue;
    }
    total += brl;
  }
  return { total_cents: total, unconverted };
}

/** Sum by category slug, for the "saída por categoria" breakdown. */
type CategorisedEntry = Entry & { category_slug?: string | null };

export function byCategory(
  rows: readonly CategorisedEntry[],
  month: string,
): Array<{ slug: string; total_cents: number }> {
  const totals = new Map<string, number>();
  // inAccrualMonth narrows to Entry, which drops the slug — filter here so the
  // extra field survives.
  for (const row of rows.filter((r) => r.date_accrual.startsWith(month))) {
    const brl = row.amount_brl_cents;
    if (brl === null || brl >= 0 || row.category_kind === "transfer") continue;
    const slug = row.category_slug ?? "sem-categoria";
    totals.set(slug, (totals.get(slug) ?? 0) + -brl);
  }
  return [...totals.entries()]
    .map(([slug, total_cents]) => ({ slug, total_cents }))
    .sort((a, b) => b.total_cents - a.total_cents);
}
