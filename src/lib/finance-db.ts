import type { Database } from "@/types/database";

/**
 * Row aliases for the finance tables, plus the one derivation that is real
 * logic rather than a type.
 *
 * This file used to carry a loose client — `fin(supabase)` — because 049 and
 * 051 were written before they were applied, so `supabase.from("fin_entries")`
 * did not typecheck against generated types that had never seen the tables.
 * That escape hatch is gone: these are the generated rows now, and every call
 * site goes through the normal client.
 */
type T = Database["public"]["Tables"];

export type AccountRow = T["fin_accounts"]["Row"];
export type CategoryRow = T["fin_categories"]["Row"];
export type EntryRow = T["fin_entries"]["Row"];
export type ReceivableRow = T["fin_receivables"]["Row"];
export type PayableRow = T["fin_payables"]["Row"];
export type SupplierRow = T["fin_suppliers"]["Row"];
export type FxRow = T["fin_fx_rates"]["Row"];
export type ImportRow = T["fin_imports"]["Row"];
export type ImportLineRow = T["fin_import_lines"]["Row"];

/**
 * Account balances are derived from the ledger, never stored.
 *
 * A stored balance is a second source of truth that drifts the first time a
 * write half-fails, and then two screens disagree about how much money there
 * is. Summing is cheap at this volume and cannot drift.
 */
export function balancesByAccount(
  entries: readonly Pick<EntryRow, "account_id" | "amount_cents">[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const e of entries) {
    if (!e.account_id) continue;
    totals.set(e.account_id, (totals.get(e.account_id) ?? 0) + e.amount_cents);
  }
  return totals;
}
