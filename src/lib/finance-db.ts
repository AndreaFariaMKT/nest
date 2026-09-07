import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * TEMPORARY — delete once migration 049 is applied and `npm run types:gen`
 * has run, the same arrangement as @/lib/projects-db and for the same reason:
 * database.gen.ts is generated from the live schema, so none of the fin_*
 * tables are in its union yet and `supabase.from("fin_entries")` does not
 * typecheck.
 *
 * The row shapes stay honest, so the pages built on them are checked as
 * normal. What is unchecked is one edge.
 */
export type AccountRow = {
  id: string;
  tenant_id: string;
  name: string;
  institution: string | null;
  currency: string;
  kind: string;
  is_active: boolean;
};

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  sort: number;
};

export type EntryRow = {
  id: string;
  account_id: string | null;
  category_id: string | null;
  description: string;
  amount_cents: number;
  currency: string;
  date_cash: string;
  date_accrual: string;
  client_id: string | null;
  project_id: string | null;
  supplier_id: string | null;
  reconciled: boolean;
  external_ref: string | null;
};

export type ReceivableRow = {
  id: string;
  client_id: string | null;
  project_id: string | null;
  description: string;
  amount_cents: number;
  currency: string;
  due_on: string;
  paid_on: string | null;
  date_accrual: string;
  status: string;
  invoice_status: string;
};

export type PayableRow = {
  id: string;
  supplier_id: string | null;
  category_id: string | null;
  description: string;
  amount_cents: number;
  currency: string;
  due_on: string;
  paid_on: string | null;
  date_accrual: string;
  status: string;
};

export type SupplierRow = {
  id: string;
  name: string;
  category: string | null;
  doc_type: string | null;
  doc_number: string | null;
  pix_key: string | null;
  default_amount_cents: number | null;
  pay_day: number | null;
  note_status: string;
};

export type FxRow = {
  day: string;
  base: string;
  quote: string;
  rate: number;
};

type FinTable =
  | "fin_accounts"
  | "fin_categories"
  | "fin_suppliers"
  | "fin_entries"
  | "fin_receivables"
  | "fin_payables"
  | "fin_fx_rates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = { from: (table: FinTable) => any };

export function fin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
): LooseClient {
  return supabase as unknown as LooseClient;
}

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
