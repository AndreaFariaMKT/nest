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

/**
 * TEMPORARY — pending migration 054, then delete and re-run `types:gen`.
 *
 * 054 adds `fin_entries.amount_brl_cents` and the `fin_account_balances(uuid)`
 * function, so neither is in the generated types yet. Confined here rather
 * than cast at each call site, the same arrangement 048–052 used.
 */
export type EntryWithBase = EntryRow & { amount_brl_cents: number | null };

export type AccountBalance = {
  account_id: string;
  balance_cents: number;
  unconverted: number;
};

/** `supabase.rpc` typed for 054's function. */
export function accountBalances(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tenantId: string,
): Promise<{ data: AccountBalance[] | null }> {
  return supabase.rpc("fin_account_balances", { p_tenant: tenantId });
}
