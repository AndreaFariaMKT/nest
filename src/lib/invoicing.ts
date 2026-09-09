/**
 * When a nota fiscal is owed, and by when.
 *
 * The studio's rules, as the finance manual states them:
 *
 *   1. The nota comes AFTER the payment, never before.
 *   2. Five business days from the confirmed receipt to send it.
 *   3. An international client is an export and gets no Brazilian nota —
 *      only the invoice.
 *
 * Rule 3 is not a nicety. Billing an export as domestic revenue puts it in the
 * wrong bracket and generates tax that was never owed, which is the specific
 * mistake the manual was written to stop.
 */

export type InvoiceCandidate = {
  paid_on: string | null;
  invoice_status: string;
  /** From clients.country — 'BR' or 'US'. Null when there is no client. */
  country: string | null;
};

export const INVOICE_DEADLINE_BUSINESS_DAYS = 5;

/**
 * An export produces no Brazilian nota, whatever else is true of it.
 *
 * Decided by the client's country OR by the row already being marked as one:
 * keying on country alone let a receivable with `invoice_status = 'export'`
 * and a BR-or-unknown client fall out of the queue AND out of the export list
 * — vanishing from both, which is exactly the disappearance the two-list split
 * exists to prevent.
 */
export function isExport(
  country: string | null,
  invoiceStatus?: string,
): boolean {
  if (invoiceStatus === "export") return true;
  return country !== null && country !== "BR";
}

/**
 * Does this receipt still owe a nota?
 *
 * Unpaid rows are excluded by rule 1 rather than by being "not ready" — asking
 * for a nota against money that has not arrived is the thing the rule forbids.
 */
export function needsInvoice(row: InvoiceCandidate): boolean {
  if (row.paid_on === null) return false;
  if (isExport(row.country, row.invoice_status)) return false;
  return row.invoice_status === "pending" || row.invoice_status === "requested";
}

/**
 * Add business days to an ISO date, skipping Saturday and Sunday.
 *
 * Holidays are not modelled. Encoding the Brazilian calendar — national, state
 * and municipal, all moving — would be a second product, and the failure mode
 * is a deadline that reads one day tight rather than one that is silently
 * wrong for a year.
 */
export function addBusinessDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  let added = 0;
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return date.toISOString().slice(0, 10);
}

/** The day the nota is due, from the day the money landed. */
export function invoiceDueOn(paidOn: string): string {
  return addBusinessDays(paidOn, INVOICE_DEADLINE_BUSINESS_DAYS);
}

export function isInvoiceLate(paidOn: string, todayIso: string): boolean {
  return todayIso > invoiceDueOn(paidOn);
}

/**
 * The queue, ordered by what is most overdue.
 *
 * Exports are returned separately rather than filtered away: the screen has to
 * say "these three are exports and need nothing" out loud, because a row that
 * simply vanishes from a to-do list looks like a row that was forgotten.
 */
export function invoiceQueue<T extends InvoiceCandidate>(
  rows: readonly T[],
  todayIso: string,
): { due: Array<T & { due_on: string; late: boolean }>; exports: T[] } {
  const exports = rows.filter(
    (r) => r.paid_on !== null && isExport(r.country, r.invoice_status),
  );

  const due = rows
    .filter(needsInvoice)
    .map((r) => ({
      ...r,
      due_on: invoiceDueOn(r.paid_on as string),
      late: isInvoiceLate(r.paid_on as string, todayIso),
    }))
    .sort((a, b) => a.due_on.localeCompare(b.due_on));

  return { due, exports };
}
