import { setRequestLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Link } from "@/i18n/routing";
import type { Route } from "next";
import { formatCents, formatCentsAsBrl } from "@/lib/money";
import { cashFlow, monthResult, byCategory } from "@/lib/finance";
import { loadFinance } from "@/lib/finance-load";

export const dynamic = "force-dynamic";

/** The twelve months of a year, as ISO prefixes. */
function monthsOf(year: number): string[] {
  return Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
  );
}

export default async function CashflowPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("finance.cashflow");
  const tf = await getTranslations("finance");

  const view = (Array.isArray(sp.view) ? sp.view[0] : sp.view) === "year"
    ? "year"
    : "month";
  const requested = Array.isArray(sp.month) ? sp.month[0] : sp.month;

  const f = await loadFinance(requested);
  const month = f.currentMonth;
  const year = Number(month.slice(0, 4));

  const categoryName = new Map(f.categories.map((c) => [c.slug, c.name]));
  const accountName = new Map(f.accounts.map((a) => [a.id, a.name]));

  const money = (c: number) => formatCentsAsBrl(c);
  const monthLabel = (m: string) =>
    new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
      new Date(`${m}-01T12:00:00Z`),
    );

  const rows = f.entries.filter((e) =>
    view === "month" ? e.date_cash.startsWith(month) : e.date_cash.startsWith(String(year)),
  );

  const spend = byCategory(f.entries, month);
  const totalSpend = spend.reduce((s, x) => s + x.total_cents, 0);

  const tab = (v: "month" | "year") =>
    (`/finance/cashflow?view=${v}&month=${month}`) as Route;

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={view === "month" ? t("subtitleMonth") : t("subtitleYear")}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {(["month", "year"] as const).map((v) => (
          <Link
            key={v}
            href={tab(v)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              view === v
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(`tabs.${v}`)}
          </Link>
        ))}
      </div>

      {/* Month picker. A year of them fits on one line and beats a date input
          for a screen you move through month by month. */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {monthsOf(year).map((m) => (
          <Link
            key={m}
            href={(`/finance/cashflow?view=${view}&month=${m}`) as Route}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              m === month
                ? "bg-brand text-brand-foreground"
                : m > f.today.slice(0, 7)
                  ? "bg-muted/50 text-muted-foreground/60 hover:text-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {new Intl.DateTimeFormat(locale, { month: "short" }).format(
              new Date(`${m}-01T12:00:00Z`),
            )}
          </Link>
        ))}
      </div>

      {view === "month" ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("inflow")}
              </div>
              <div className="mt-3 font-display text-2xl leading-none text-emerald-700 dark:text-emerald-400">
                {money(f.monthCash.inflow)}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("outflow")}
              </div>
              <div className="mt-3 font-display text-2xl leading-none text-foreground">
                {money(f.monthCash.outflow)}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("balance")}
              </div>
              <div
                className={`mt-3 font-display text-2xl leading-none ${
                  f.monthCash.balance >= 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-destructive"
                }`}
              >
                {money(f.monthCash.balance)}
              </div>
            </div>
          </div>

          {/* Revenue → profit, on the accrual side. Beside the cash numbers
              above on purpose: seeing them disagree is the point. */}
          <section className="mb-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("toProfit")}
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt>{t("revenue")}</dt>
                <dd className="tabular-nums">{money(f.monthAccrual.revenue)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("cost")}</dt>
                <dd className="tabular-nums text-destructive">
                  − {money(f.monthAccrual.cost)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-2 font-medium">
                <dt>
                  {t("profit")}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {t("margin", { margin: f.monthAccrual.margin })}
                  </span>
                </dt>
                <dd
                  className={`tabular-nums ${
                    f.monthAccrual.profit >= 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-destructive"
                  }`}
                >
                  {money(f.monthAccrual.profit)}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              {t("twoDates")}
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("entries", { month: monthLabel(month) })}
            </h2>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noEntries")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">{t("th.cash")}</th>
                      <th className="py-2 pr-3 font-medium">{t("th.accrual")}</th>
                      <th className="py-2 pr-3 font-medium">{t("th.description")}</th>
                      <th className="py-2 pr-3 font-medium">{t("th.category")}</th>
                      <th className="py-2 pr-3 font-medium">{t("th.account")}</th>
                      <th className="py-2 pr-3 text-right font-medium">{t("th.amount")}</th>
                      <th className="py-2 text-right font-medium">{t("th.reconciled")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => (
                      <tr key={e.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-3 tabular-nums">{e.date_cash}</td>
                        <td
                          className={`py-2 pr-3 tabular-nums ${
                            e.date_accrual.slice(0, 7) !== e.date_cash.slice(0, 7)
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-muted-foreground"
                          }`}
                          // Highlighted when the two months differ, because
                          // that row is the reason the two totals above do not
                          // match and it is otherwise invisible.
                          title={t("differentMonth")}
                        >
                          {e.date_accrual}
                        </td>
                        <td className="py-2 pr-3">{e.description}</td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {e.category_slug
                            ? categoryName.get(e.category_slug) ?? e.category_slug
                            : "—"}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {e.account_id ? accountName.get(e.account_id) ?? "—" : "—"}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right tabular-nums ${
                            e.amount_cents >= 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : ""
                          }`}
                        >
                          {formatCents(e.amount_cents, e.currency)}
                        </td>
                        <td className="py-2 text-right">
                          <Pill tone={e.reconciled ? "success" : "warning"}>
                            {e.reconciled ? t("yes") : t("pendingWord")}
                          </Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {spend.length > 0 ? (
            <section className="mt-4 rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {tf("spendByCategory")}
              </h2>
              <ul className="space-y-3">
                {spend.map((s) => (
                  <li key={s.slug}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span>{categoryName.get(s.slug) ?? s.slug}</span>
                      <span className="tabular-nums">{money(s.total_cents)}</span>
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
            </section>
          ) : null}
        </>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("yearTitle", { year })}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t("th.month")}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t("inflow")}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t("outflow")}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t("balance")}</th>
                  <th className="py-2 text-right font-medium">{t("profit")}</th>
                </tr>
              </thead>
              <tbody>
                {monthsOf(year).map((m) => {
                  const c = cashFlow(f.entries, m);
                  const r = monthResult(f.entries, m);
                  const future = m > f.today.slice(0, 7);
                  return (
                    <tr
                      key={m}
                      className={`border-b border-border last:border-0 ${future ? "opacity-50" : ""}`}
                    >
                      <td className="py-2 pr-3">
                        <Link
                          href={(`/finance/cashflow?view=month&month=${m}`) as Route}
                          className="hover:text-brand"
                        >
                          {monthLabel(m)}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{money(c.inflow)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{money(c.outflow)}</td>
                      <td
                        className={`py-2 pr-3 text-right tabular-nums ${
                          c.balance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
                        }`}
                      >
                        {money(c.balance)}
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums ${
                          r.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
                        }`}
                      >
                        {money(r.profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t("twoDates")}</p>
        </section>
      )}
    </div>
  );
}
