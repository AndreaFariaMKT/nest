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

  const [
    accountsRes,
    categoriesRes,
    entriesRes,
    receivablesRes,
    payablesRes,
    fxRes,
    balancesRes,
  ] = await Promise.all([
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
      // Joins the wave rather than following it: it depends on none of the
      // others, and a sequential round trip to a database in another
      // hemisphere is ~150ms of a click nobody gets back.
      supabase.rpc("fin_account_balances", { p_tenant: tenantId }),
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
  const balanceRows = balancesRes.data;
  const balances = new Map((balanceRows ?? []).map((b) => [b.account_id, b]));
  const withBalance = accounts.map((a) => ({
    ...a,
    balance_cents: balances.get(a.id)?.balance_cents ?? 0,
    unconverted: balances.get(a.id)?.unconverted ?? 0,
  }));

  const operating = operatingBalance(withBalance);
  const reserve = reserveBalance(withBalance);
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

/**
 * Just the two revenue figures the leadership block shows.
 *
 * The block needs the month's accrual revenue and its cash inflow. It was
 * calling `loadFinance()` for them, which reads accounts, categories, every
 * entry in a fourteen-month range, receivables, payables, exchange rates and
 * the balance aggregate — seven queries and, before this, two round trips — to
 * render two numbers on the screen you land on after logging in.
 *
 * One query, one wave, and only the month asked for.
 */
export async function loadMonthRevenue(month?: string): Promise<{
  expected_cents: number;
  cash_cents: number;
  unconverted: number;
}> {
  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const target = month ?? todayIso().slice(0, 7);

  // Both dates matter and they select different rows, so the range has to
  // cover either column landing in the month.
  const from = `${target}-01`;
  const to = `${target}-31`;

  // The category is joined, not just selected. `category_id` used to be read
  // from the database and then never looked at, and the transfer rule went
  // with it: moving R$ 20.000 into the reserve is a positive entry, so the
  // home screen counted it as revenue while /finance — which does apply the
  // rule — denied it. The two screens disagreed by the size of the transfer,
  // and the one people see on login was the optimistic one.
  const { data } = await supabase
    .from("fin_entries")
    .select(
      "amount_brl_cents, date_cash, date_accrual, category:fin_categories(kind)",
    )
    .eq("tenant_id", tenantId)
    .or(
      `and(date_cash.gte.${from},date_cash.lte.${to}),and(date_accrual.gte.${from},date_accrual.lte.${to})`,
    );

  const rows = (data ?? []) as Array<{
    amount_brl_cents: number | null;
    date_cash: string;
    date_accrual: string;
    category: { kind: string } | null;
  }>;
  let expected = 0;
  let cash = 0;
  let unconverted = 0;

  for (const row of rows) {
    // Money between the studio's own accounts is not income on either axis —
    // the same exclusion monthResult and cashFlow apply in @/lib/finance.
    if (row.category?.kind === "transfer") continue;
    if (row.amount_brl_cents === null) {
      unconverted += 1;
      continue;
    }
    if (row.amount_brl_cents <= 0) continue;
    if (row.date_accrual.startsWith(target)) expected += row.amount_brl_cents;
    if (row.date_cash.startsWith(target)) cash += row.amount_brl_cents;
  }

  return { expected_cents: expected, cash_cents: cash, unconverted };
}
