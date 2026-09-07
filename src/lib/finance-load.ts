import "server-only";

import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { OPTION_LIST_CAP } from "@/lib/pagination";
import { todayIso } from "@/lib/social";
import {
  operatingBalance,
  openTotal,
  rateOnOrBefore,
  reserveBalance,
  workingCapital,
  monthsOfRunway,
  cashFlow,
  monthResult,
  type FxRate,
} from "@/lib/finance";
import {
  fin,
  balancesByAccount,
  type AccountRow,
  type CategoryRow,
  type EntryRow,
  type PayableRow,
  type ReceivableRow,
} from "@/lib/finance-db";

/**
 * One read of the studio's money, shared by every finance screen.
 *
 * The dashboard, the month view and the leadership block on /today all need
 * overlapping slices of the same six tables. Loading them in one place keeps
 * the six numbers on the home screen and the six on /finance from being
 * computed two different ways and quietly disagreeing.
 */
export async function loadFinance(month?: string) {
  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const today = todayIso();
  const currentMonth = month ?? today.slice(0, 7);

  const [accountsRes, categoriesRes, entriesRes, receivablesRes, payablesRes, fxRes] =
    await Promise.all([
      fin(supabase)
        .from("fin_accounts")
        .select("id, tenant_id, name, institution, currency, kind, is_active")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name", { ascending: true }),
      fin(supabase)
        .from("fin_categories")
        .select("id, name, slug, kind, sort")
        .eq("tenant_id", tenantId)
        .order("sort", { ascending: true }),
      fin(supabase)
        .from("fin_entries")
        .select(
          "id, account_id, category_id, description, amount_cents, currency, date_cash, date_accrual, client_id, project_id, supplier_id, reconciled, external_ref",
        )
        .eq("tenant_id", tenantId)
        .order("date_cash", { ascending: false })
        .limit(OPTION_LIST_CAP),
      fin(supabase)
        .from("fin_receivables")
        .select(
          "id, client_id, project_id, description, amount_cents, currency, due_on, paid_on, date_accrual, status, invoice_status",
        )
        .eq("tenant_id", tenantId)
        .order("due_on", { ascending: true })
        .limit(OPTION_LIST_CAP),
      fin(supabase)
        .from("fin_payables")
        .select(
          "id, supplier_id, category_id, description, amount_cents, currency, due_on, paid_on, date_accrual, status",
        )
        .eq("tenant_id", tenantId)
        .order("due_on", { ascending: true })
        .limit(OPTION_LIST_CAP),
      fin(supabase)
        .from("fin_fx_rates")
        .select("day, base, quote, rate")
        .eq("tenant_id", tenantId)
        .order("day", { ascending: false })
        .limit(400),
    ]);

  const accounts = (accountsRes.data ?? []) as AccountRow[];
  const categories = (categoriesRes.data ?? []) as CategoryRow[];
  const entries = (entriesRes.data ?? []) as EntryRow[];
  const receivables = (receivablesRes.data ?? []) as ReceivableRow[];
  const payables = (payablesRes.data ?? []) as PayableRow[];
  const rates = ((fxRes.data ?? []) as FxRate[]).map((r) => ({
    ...r,
    rate: Number(r.rate),
  }));

  const rateFor = (day: string) => rateOnOrBefore(rates, day);
  const todayRate = rateFor(today);

  const balances = balancesByAccount(entries);
  const withBalance = accounts.map((a) => ({
    ...a,
    balance_cents: balances.get(a.id) ?? 0,
  }));

  const operating = operatingBalance(withBalance, todayRate);
  const reserve = reserveBalance(withBalance, todayRate);
  const receivable = openTotal(receivables, rateFor);
  const payable = openTotal(payables, rateFor);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const enriched = entries.map((e) => ({
    ...e,
    category_kind: e.category_id
      ? categoryById.get(e.category_id)?.kind ?? null
      : null,
    category_slug: e.category_id
      ? categoryById.get(e.category_id)?.slug ?? null
      : null,
  }));

  const monthCash = cashFlow(enriched, currentMonth);
  const monthAccrual = monthResult(enriched, currentMonth);

  return {
    today,
    currentMonth,
    todayRate,
    rateFor,
    accounts: withBalance,
    categories,
    entries: enriched,
    receivables,
    payables,
    operating,
    reserve,
    receivableOpen: receivable,
    payableOpen: payable,
    workingCapital: workingCapital({
      operating_cents: operating,
      receivable_cents: receivable.total_cents,
      payable_cents: payable.total_cents,
    }),
    // Runway is measured against the month's real operating cost, not an
    // average — an average over a ledger that starts this month is the same
    // number wearing a hat.
    runway: monthsOfRunway(operating, monthAccrual.cost),
    reserveRunway: monthsOfRunway(reserve, monthAccrual.cost),
    monthCash,
    monthAccrual,
  };
}
