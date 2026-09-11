import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { OPTION_LIST_CAP } from "@/lib/pagination";
import { todayIso } from "@/lib/social";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Link } from "@/i18n/routing";
import { formatCents } from "@/lib/money";
import { EntryForm } from "./EntryForm";
import { deleteEntryAction } from "./actions";

export const dynamic = "force-dynamic";

/** The list is a list, so it is capped. Every total on every other finance
 *  screen comes from a date range or from SQL, never from this page size. */
const RECENT = 60;

export default async function EntriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("finance.entries");

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const today = todayIso();

  const [
    accountsRes,
    categoriesRes,
    clientsRes,
    projectsRes,
    suppliersRes,
    entriesRes,
  ] = await Promise.all([
    supabase.from("fin_accounts")
      .select("id, name, currency")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.from("fin_categories")
      .select("id, name, kind, sort")
      .eq("tenant_id", tenantId)
      .order("sort", { ascending: true }),
    supabase.from("clients")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true })
      .limit(OPTION_LIST_CAP),
    supabase.from("projects")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true })
      .limit(OPTION_LIST_CAP),
    supabase.from("fin_suppliers")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true })
      .limit(OPTION_LIST_CAP),
    supabase.from("fin_entries")
      .select(
        "id, description, amount_cents, currency, date_cash, date_accrual, account_id, category_id, reconciled",
      )
      .eq("tenant_id", tenantId)
      .order("date_cash", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(RECENT),
  ]);

  const accounts = accountsRes.data ?? [];
  const categories = categoriesRes.data ?? [];
  const entries = entriesRes.data ?? [];

  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("add")}
        </h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("noAccountsYet")}{" "}
            <Link
              href="/finance/accounts"
              className="underline underline-offset-4"
            >
              {t("goToAccounts")}
            </Link>
          </p>
        ) : (
          <EntryForm
            locale={locale}
            today={today}
            accounts={accounts}
            categories={categories}
            clients={clientsRes.data ?? []}
            projects={projectsRes.data ?? []}
            suppliers={suppliersRes.data ?? []}
          />
        )}
      </section>

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t("th.cash")}</th>
                <th className="px-4 py-3 font-medium">{t("th.description")}</th>
                <th className="px-4 py-3 font-medium">{t("th.category")}</th>
                <th className="px-4 py-3 font-medium">{t("th.account")}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {t("th.amount")}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border last:border-0"
                  data-testid="entry-row"
                >
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                    {e.date_cash}
                    {/* Said out loud when the two dates disagree: this is
                        where the difference between balanço and lucro comes
                        from, and it is invisible otherwise. */}
                    {e.date_accrual !== e.date_cash ? (
                      <span className="block text-xs">
                        {t("accrualIs", { date: e.date_accrual })}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{e.description}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.category_id
                      ? categoryName.get(e.category_id) ?? "—"
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.account_id ? accountName.get(e.account_id) ?? "—" : "—"}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${
                      e.amount_cents < 0 ? "text-destructive" : ""
                    }`}
                  >
                    {formatCents(e.amount_cents, e.currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {e.reconciled ? (
                      <Pill tone="success">{t("reconciled")}</Pill>
                    ) : (
                      <form action={deleteEntryAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <button
                          type="submit"
                          className="text-xs text-destructive underline underline-offset-4"
                        >
                          {t("delete")}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">{t("footnote")}</p>
    </div>
  );
}
