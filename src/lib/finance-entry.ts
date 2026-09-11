/**
 * The rules a person's typing has to pass before it becomes a ledger row.
 *
 * Everything in here is pure and small on purpose. The three screens that
 * write money — manual entries, receivables and payables — each need the same
 * four decisions, and until now none of them existed in code at all: the only
 * writer of fin_entries was the reconciliation confirm path, so the whole
 * module could be read and none of it could be filled in.
 */

import { isExport } from "@/lib/invoicing";

/** How a person describes a movement: money in, or money out. */
export type Direction = "in" | "out";

/**
 * Turn a magnitude and a direction into the signed cents the ledger stores.
 *
 * `fin_entries.amount_cents` is signed — negative is money leaving — so that
 * summing a month is a sum and cannot be got wrong by forgetting to branch on
 * a direction flag. That decision moves the branch here, to the one place a
 * person chooses the direction.
 *
 * The magnitude is taken as an absolute value even though `parseBrlToCents`
 * already refuses a negative: a "-350" typed into the amount of an expense
 * would otherwise mean "out of out", and flip a cost into revenue.
 */
export function signedAmount(
  direction: Direction,
  magnitudeCents: number,
): number {
  const magnitude = Math.abs(magnitudeCents);
  return direction === "out" ? -magnitude : magnitude;
}

/**
 * Which month the entry belongs to, when the person did not say.
 *
 * The default is the cash date, never today. A payment typed on the 3rd of
 * October for money that moved on 28 September belongs to September on both
 * axes unless someone says otherwise — defaulting to today would push it into
 * October's profit and quietly disagree with the accountant's close.
 *
 * A typed accrual always wins: that field exists precisely for the retainer
 * that was earned in August and paid in September.
 */
export function accrualFor(
  dateCash: string,
  typed: string | null | undefined,
): string {
  const t = (typed ?? "").trim();
  return t.length > 0 ? t : dateCash;
}

/**
 * The status to show for a receivable or a payable.
 *
 * Derived at read time, not stored. `late` is never written to the column by
 * any code path — a stored `late` would need a nightly job to keep it true,
 * and the day that job failed the screen would say "em dia" about money that
 * was three weeks overdue. Computing it from the due date cannot go stale.
 */
export function obligationStatus(
  row: { paid_on: string | null; status: string; due_on: string },
  todayIso: string,
): "paid" | "cancelled" | "late" | "open" {
  if (row.status === "cancelled") return "cancelled";
  if (row.paid_on !== null) return "paid";
  return row.due_on < todayIso ? "late" : "open";
}

/**
 * The invoice status a new receivable starts in.
 *
 * An American client's receivable is born `export` rather than `pending`,
 * because there is no Brazilian nota to ever issue for it. Starting it at
 * `pending` puts it in the nota queue on day one and it leaves that queue only
 * when someone notices — and the manual's rule 3 exists because billing an
 * export as domestic revenue generates tax that was never owed.
 */
export function initialInvoiceStatus(
  country: string | null,
): "pending" | "export" {
  return isExport(country) ? "export" : "pending";
}

/**
 * Read an exchange rate a person typed.
 *
 * Deliberately NOT `parseBrlToCents`. That function reads a lone dot in
 * "5.370" as a thousands separator, which is right for money and catastrophic
 * for a rate — it would turn a typo into 5370 reais to the dollar and convert
 * the studio's Wise balance into something in the billions. A rate is a small
 * ratio, so both separators mean the same thing here and neither ever groups
 * thousands.
 *
 * The ceiling is arbitrary but has to exist: a rate is bounded by reality, and
 * nothing the studio will ever quote is above 1000.
 */
export function parseRate(input: string): number | null {
  const s = input.trim().replace(/\s+/g, "").replace(",", ".");
  if (s === "") return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 1000) return null;
  // Six decimals is what the column stores; rounding here rather than letting
  // Postgres do it keeps what the screen echoes back identical to what was
  // saved.
  return Math.round(n * 1e6) / 1e6;
}
