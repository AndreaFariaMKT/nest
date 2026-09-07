import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { OPTION_LIST_CAP } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Link } from "@/i18n/routing";
import { formatCentsAsBrl, sumCents } from "@/lib/money";
import { isOverdue, byCategory } from "@/lib/finance";
import { loadFinance } from "@/lib/finance-load";

export const dynamic = "force-dynamic";

function Measure({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-3 font-display text-2xl leading-none ${
          tone === "pos"
            ? "text-emerald-700 dark:text-emerald-400"
            : tone === "neg"
              ? "text-destructive"
              : "text-foreground"
        }`}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

export default async function FinancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("finance");

  const f = await loadFinance();
  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const { data: clientRows } = await supabase
    .from("clients")
    .select("id, name, slug")
    .eq("tenant_id", tenantId)
    .limit(OPTION_LIST_CAP);
  const clientById = new Map(
    (clientRows ?? []).map((c) => [c.id, c] as const),
  );

  const overdueReceivables = f.receivables.filter((r) => isOverdue(r, f.today));
  const spend = byCategory(f.entries, f.currentMonth);
  const categoryName = new Map(f.categories.map((c) => [c.slug, c.name]));
  const totalSpend = sumCents(spend.map((s) => s.total_cents));

  const money = (cents: number) => formatCentsAsBrl(cents);
  const months = (n: number | null) =>
    n === null ? "—" : `${n.toFixed(1).replace(".", ",")} ${t("months")}`;

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Link
            href="/finance/contracts"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t("contractsLink")}
          </Link>
        }
      />

      {/* The six measures from the top of the prototype. Balanço is cash,
          lucro is competência — see @/lib/finance for why they differ. */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Measure
          label={t("measures.receivable")}
          value={money(f.receivableOpen.total_cents)}
          hint={
            f.receivableOpen.unconverted > 0
              ? t("noRate", { count: f.receivableOpen.unconverted })
              : t("measures.receivableHint")
          }
        />
        <Measure
          label={t("measures.payable")}
          value={money(f.payableOpen.total_cents)}
          hint={
            f.payableOpen.unconverted > 0
              ? t("noRate", { count: f.payableOpen.unconverted })
              : t("measures.payableHint")
          }
        />
        <Measure
          label={t("measures.balance")}
          value={money(f.monthCash.balance)}
          tone={f.monthCash.balance >= 0 ? "pos" : "neg"}
          hint={t("measures.balanceHint")}
        />
        <Measure
          label={t("measures.profit")}
          value={money(f.monthAccrual.profit)}
          tone={f.monthAccrual.profit >= 0 ? "pos" : "neg"}
          hint={t("measures.profitHint", { margin: f.monthAccrual.margin })}
        />
        <Measure
          label={t("measures.working")}
          value={money(f.workingCapital)}
          hint={t("measures.workingHint", { months: months(f.runway) })}
        />
        <Measure
          label={t("measures.reserve")}
          value={money(f.reserve)}
          hint={t("measures.reserveHint", { months: months(f.reserveRunway) })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Where the money is */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("accounts")}
          </h2>
          {f.accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noAccounts")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {f.accounts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{a.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.institution ?? a.currency} ·{" "}
                      {a.kind === "reserva" ? t("kindReserve") : t("kindOperating")}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {a.currency === "BRL"
                      ? money(a.balance_cents)
                      : `${a.currency} ${(a.balance_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {f.todayRate === null ? (
            <p className="mt-3 text-xs text-destructive">{t("noRateToday")}</p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("rateToday", {
                rate: f.todayRate.toFixed(2).replace(".", ","),
              })}
            </p>
          )}
        </section>

        {/* Spend by category, this month */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("spendByCategory")}
          </h2>
          {spend.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noSpend")}</p>
          ) : (
            <ul className="space-y-3">
              {spend.map((s) => (
                <li key={s.slug}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">
                      {categoryName.get(s.slug) ?? s.slug}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {money(s.total_cents)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-brand"
                      style={{
                        width: `${totalSpend === 0 ? 0 : Math.round((s.total_cents / totalSpend) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Overdue first: it is the only part of this screen that needs an
          action today. */}
      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("receivables")}
        </h2>
        {f.receivables.filter((r) => r.paid_on === null).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noReceivables")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {f.receivables
              .filter((r) => r.paid_on === null && r.status !== "cancelled")
              .map((r) => {
                const client = r.client_id ? clientById.get(r.client_id) : null;
                const late = isOverdue(r, f.today);
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">
                        {client?.name ?? t("noClient")}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.description} · {r.due_on}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {r.invoice_status === "export" ? (
                        <Pill tone="muted">{t("invoice.export")}</Pill>
                      ) : (
                        <Pill
                          tone={
                            r.invoice_status === "issued" ? "success" : "warning"
                          }
                        >
                          {t(`invoice.${r.invoice_status}`)}
                        </Pill>
                      )}
                      {late ? <Pill tone="danger">{t("late")}</Pill> : null}
                      <span className="tabular-nums">
                        {r.currency === "BRL"
                          ? money(r.amount_cents)
                          : `${r.currency} ${(r.amount_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      </span>
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
        {overdueReceivables.length > 0 ? (
          <p className="mt-3 text-xs text-destructive">
            {t("overdueCount", { count: overdueReceivables.length })}
          </p>
        ) : null}
      </section>
    </div>
  );
}
