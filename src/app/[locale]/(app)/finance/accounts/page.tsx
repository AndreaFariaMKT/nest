import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { todayIso } from "@/lib/social";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { formatCents } from "@/lib/money";
import type { AccountRow } from "@/lib/finance-db";
import { AccountForm } from "./AccountForm";
import { RateForm } from "./RateForm";
import { toggleAccountAction, deleteRateAction } from "./actions";

export const dynamic = "force-dynamic";

type RateRow = {
  id: string;
  day: string;
  rate: number | string;
  source: string | null;
};

/**
 * Where the money is kept, and what a dollar is worth.
 *
 * These two belong on one screen because they are the same prerequisite: until
 * an account exists the ledger has nowhere to put a movement, and until a rate
 * exists nothing held in dollars can be added to anything held in reais. Both
 * were missing, which is why the dashboard read "Nenhuma conta cadastrada
 * ainda" and every USD total said "sem câmbio".
 */
export default async function AccountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("finance.accounts");

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const today = todayIso();

  const [accountsRes, balancesRes, ratesRes] = await Promise.all([
    // Inactive ones are listed too — archiving has to be undoable from the
    // same screen that did it, or the only way back is SQL.
    supabase.from("fin_accounts")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true })
      .limit(OPTION_LIST_CAP),
    supabase.rpc("fin_account_balances", { p_tenant: tenantId }),
    supabase.from("fin_fx_rates")
      .select("id, day, rate, source")
      .eq("tenant_id", tenantId)
      .eq("base", "USD")
      .eq("quote", "BRL")
      .order("day", { ascending: false })
      .limit(14),
  ]);

  const accounts = (accountsRes.data ?? []) as AccountRow[];
  const balances = new Map(
    (balancesRes.data ?? []).map((b) => [b.account_id, b]),
  );
  const rates = (ratesRes.data ?? []) as RateRow[];
  const hasToday = rates.some((r) => r.day === today);

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("add")}
        </h2>
        <AccountForm locale={locale} />
      </section>

      {accounts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {accounts.map((a) => {
            const balance = balances.get(a.id);
            return (
              <li
                key={a.id}
                className={`rounded-2xl border border-border bg-card p-5 ${
                  a.is_active ? "" : "opacity-60"
                }`}
                data-testid="account-row"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{a.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[
                        a.institution,
                        a.currency,
                        t(`kinds.${a.kind}`),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {a.is_active ? null : (
                      <Pill tone="muted">{t("archived")}</Pill>
                    )}
                    {/* An account whose ledger holds a currency with no rate
                        reports it rather than showing a total that silently
                        left money out. */}
                    {balance && balance.unconverted > 0 ? (
                      <Pill tone="warning">
                        {t("unconverted", { count: balance.unconverted })}
                      </Pill>
                    ) : null}
                    <span className="tabular-nums">
                      {formatCents(balance?.balance_cents ?? 0, a.currency)}
                    </span>
                  </div>
                </div>

                <AccountForm locale={locale} account={a} />

                <form action={toggleAccountAction} className="mt-3">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="locale" value={locale} />
                  <input
                    type="hidden"
                    name="active"
                    value={a.is_active ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className="text-xs text-muted-foreground underline underline-offset-4"
                  >
                    {a.is_active ? t("archive") : t("restore")}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("fx.title")}
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">{t("fx.hint")}</p>

        <RateForm locale={locale} today={today} />

        {!hasToday ? (
          <p className="mt-3 text-xs text-destructive">{t("fx.missingToday")}</p>
        ) : null}

        {rates.length > 0 ? (
          <ul className="mt-4 divide-y divide-border">
            {rates.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="tabular-nums text-muted-foreground">
                  {r.day}
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">
                    {Number(r.rate).toFixed(4).replace(".", ",")}
                  </span>
                  <form action={deleteRateAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <button
                      type="submit"
                      className="text-xs text-destructive underline underline-offset-4"
                    >
                      {t("fx.delete")}
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
