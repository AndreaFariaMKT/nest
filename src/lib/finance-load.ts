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
  type AccountRow,
  type CategoryRow,
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

  // Entries are read by DATE RANGE, not by "the most recent N".
  //
  // The window used to be the 500 newest rows, and every figure on every
  // finance screen was derived from it — so once the ledger passed 500 entries
  // the account balances, working capital, runway and the whole year table
  // silently understated, always in the same direction. A cap is right for a
  // list; it is wrong for anything that reports a total.
  //
  // The year is the widest thing any screen shows, and both axes are covered:
  // the month view filters on date_cash, the profit figures on date_accrual,
  // and an entry can sit in December's cash and January's competência.
  const year = currentMonth.slice(0, 4);
  const rangeStart = `${Number(year) - 1}-12-01`;
  const rangeEnd = `${Number(year) + 1}-01-31`;

  const [accountsRes, categoriesRes, entriesRes, receivablesRes, payablesRes, fxRes] =
    await Promise.all([
      supabase.from("fin_accounts")
        .select("id, tenant_id, name, institution, currency, kind, is_active")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase.from("fin_categories")
        .select("id, name, slug, kind, sort")
        .eq("tenant_id", tenantId)
        .order("sort", { ascending: true }),
      supabase.from("fin_entries")
        .select(
          "id, account_id, category_id, description, amount_cents, amount_brl_cents, currency, date_cash, date_accrual, client_id, project_id, supplier_id, reconciled, external_ref",
        )
        .eq("tenant_id", tenantId)
        .gte("date_cash", rangeStart)
        .lte("date_cash", rangeEnd)
        .order("date_cash", { ascending: false }),
      supabase.from("fin_receivables")
        .select(
          "id, client_id, project_id, description, amount_cents, currency, due_on, paid_on, date_accrual, status, invoice_status",
        )
        .eq("tenant_id", tenantId)
        .order("due_on", { ascending: true })
        .limit(OPTION_LIST_CAP),
      supabase.from("fin_payables")
        .select(
          "id, supplier_id, category_id, description, amount_cents, currency, due_on, paid_on, date_accrual, status",
        )
        .eq("tenant_id", tenantId)
        .order("due_on", { ascending: true })
        .limit(OPTION_LIST_CAP),
      supabase.from("fin_fx_rates")
        .select("day, base, quote, rate")
        .eq("tenant_id", tenantId)
        .order("day", { ascending: false })
        .limit(400),
    ]);

  const accounts = (accountsRes.data ?? []) as AccountRow[];
  const categories = (categoriesRes.data ?? []) as CategoryRow[];
  const entries = entriesRes.data ?? [];
  const receivables = (receivablesRes.data ?? []) as ReceivableRow[];
  const payables = (payablesRes.data ?? []) as PayableRow[];
  const rates = ((fxRes.data ?? []) as FxRate[]).map((r) => ({
    ...r,
    rate: Number(r.rate),
  }));

  const rateFor = (day: string) => rateOnOrBefore(rates, day);
  const todayRate = rateFor(today);

  // From the whole ledger, in SQL — see fin_account_balances in 054. Summing
  // `entries` here would sum only the range read above.
  const { data: balanceRows } = await supabase.rpc("fin_account_balances", {
    p_tenant: tenantId,
  });
  const balances = new Map((balanceRows ?? []).map((b) => [b.account_id, b]));
  const withBalance = accounts.map((a) => ({
    ...a,
    balance_cents: balances.get(a.id)?.balance_cents ?? 0,
    unconverted: balances.get(a.id)?.unconverted ?? 0,
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

  // The month before the one being viewed, which is closed and therefore a
  // whole number. Falls back to the current month only when there is no prior
  // month in the ledger at all — a first month is better than nothing, and
  // monthsOfRunway already returns null when the cost is zero.
  const prevMonth = (() => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  })();
  const prevAccrual = monthResult(enriched, prevMonth);
  const referenceCost =
    prevAccrual.cost > 0 ? prevAccrual.cost : monthAccrual.cost;

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
    // Measured against the last CLOSED month, never the running one. On the
    // 2nd, cost-to-date might be R$ 5.000 against a real R$ 50.000 — the
    // dashboard would read 20 meses instead of 2, and it would be most
    // optimistic exactly when the month has barely started.
    runway: monthsOfRunway(operating, referenceCost),
    reserveRunway: monthsOfRunway(reserve, referenceCost),
    monthCash,
    monthAccrual,
  };
}
