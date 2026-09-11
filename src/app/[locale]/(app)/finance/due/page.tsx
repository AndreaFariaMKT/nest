import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { OPTION_LIST_CAP } from "@/lib/pagination";
import { todayIso } from "@/lib/social";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill, toneOf, type Tone } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Link } from "@/i18n/routing";
import { formatCents } from "@/lib/money";
import { obligationStatus } from "@/lib/finance-entry";
import { ObligationForm } from "./ObligationForm";
import {
  markPaidAction,
  cancelObligationAction,
  deleteObligationAction,
} from "./actions";

export const dynamic = "force-dynamic";

const statusTone = {
  open: "muted",
  late: "danger",
  paid: "success",
  cancelled: "muted",
} as const satisfies Record<string, Tone>;

type Row = {
  id: string;
  description: string;
  amount_cents: number;
  currency: string;
  due_on: string;
  paid_on: string | null;
  date_accrual: string;
  status: string;
  client_id?: string | null;
  supplier_id?: string | null;
};

/**
 * What the studio is owed and what it owes.
 *
 * This screen is the one the reconciliation depends on. The matcher compares a
 * bank line against the obligations still open, and nothing in the product
 * created one — so every imported statement came back "sem correspondência"
 * and the whole matching apparatus, tests and all, was inert against real
 * data.
 */
export default async function DuePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("finance.due");

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const today = todayIso();

  const [
    receivablesRes,
    payablesRes,
    accountsRes,
    clientsRes,
    projectsRes,
    suppliersRes,
    categoriesRes,
  ] = await Promise.all([
    supabase.from("fin_receivables")
      .select(
        "id, description, amount_cents, currency, due_on, paid_on, date_accrual, status, client_id",
      )
      .eq("tenant_id", tenantId)
      .order("paid_on", { ascending: true, nullsFirst: true })
      .order("due_on", { ascending: true })
      .limit(OPTION_LIST_CAP),
    supabase.from("fin_payables")
      .select(
        "id, description, amount_cents, currency, due_on, paid_on, date_accrual, status, supplier_id",
      )
      .eq("tenant_id", tenantId)
      .order("paid_on", { ascending: true, nullsFirst: true })
      .order("due_on", { ascending: true })
      .limit(OPTION_LIST_CAP),
    supabase.from("fin_accounts")
      .select("id, name, currency")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
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
    supabase.from("fin_categories")
      .select("id, name, kind, sort")
      .eq("tenant_id", tenantId)
      .neq("kind", "income")
      .order("sort", { ascending: true }),
  ]);

  const accounts = accountsRes.data ?? [];
  const clients = clientsRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const suppliers = suppliersRes.data ?? [];
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));

  function List({
    kind,
    rows,
    nameOf,
  }: {
    kind: "receivable" | "payable";
    rows: Row[];
    nameOf: (row: Row) => string | null;
  }) {
    if (rows.length === 0) {
      return (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      );
    }
    return (
      <ul className="divide-y divide-border">
        {rows.map((row) => {
          const status = obligationStatus(row, today);
          const settled = status === "paid" || status === "cancelled";
          return (
            <li key={row.id} className="py-3" data-testid={`${kind}-row`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm">{row.description}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[
                      nameOf(row) ?? t("noCounterparty"),
                      t("dueLabel", { date: row.due_on }),
                      row.date_accrual.slice(0, 7) !== row.due_on.slice(0, 7)
                        ? t("accrualIs", { date: row.date_accrual })
                        : null,
                      row.paid_on ? t("paidOn", { date: row.paid_on }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Pill tone={toneOf(statusTone, status)}>
                    {t(`status.${status}`)}
                  </Pill>
                  <span className="tabular-nums">
                    {formatCents(row.amount_cents, row.currency)}
                  </span>
                </div>
              </div>

              {settled ? null : (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <form
                    action={markPaidAction}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="locale" value={locale} />
                    <Input
                      type="date"
                      name="paid_on"
                      defaultValue={today}
                      required
                      className="h-9 w-auto"
                      aria-label={t("paidOnLabel")}
                    />
                    {/* Required, not optional. Closing the row without an
                        account takes the amount out of "a receber" and never
                        puts it into a balance — the money would appear to
                        evaporate on the day it arrived. */}
                    <Select
                      name="account_id"
                      required
                      defaultValue={accounts[0]?.id ?? ""}
                      className="h-9 w-auto"
                      aria-label={t("account")}
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.currency}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="submit"
                      variant="brand"
                      disabled={accounts.length === 0}
                      className="h-9 px-3"
                    >
                      {t(`${kind}.settle`)}
                    </Button>
                  </form>

                  <form action={cancelObligationAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="locale" value={locale} />
                    <button
                      type="submit"
                      className="h-9 text-xs text-muted-foreground underline underline-offset-4"
                    >
                      {t("cancel")}
                    </button>
                  </form>

                  <form action={deleteObligationAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="locale" value={locale} />
                    <button
                      type="submit"
                      className="h-9 text-xs text-destructive underline underline-offset-4"
                    >
                      {t("delete")}
                    </button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {accounts.length === 0 ? (
        <p className="mb-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t("needAccount")}{" "}
          <Link href="/finance/accounts" className="underline underline-offset-4">
            {t("goToAccounts")}
          </Link>
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("receivable.title")}
          </h2>
          <ObligationForm
            kind="receivable"
            locale={locale}
            today={today}
            clients={clients}
            projects={projects}
          />
          <div className="mt-5 border-t border-border pt-2">
            <List
              kind="receivable"
              rows={(receivablesRes.data ?? []) as Row[]}
              nameOf={(r) =>
                r.client_id ? clientName.get(r.client_id) ?? null : null
              }
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("payable.title")}
          </h2>
          <ObligationForm
            kind="payable"
            locale={locale}
            today={today}
            suppliers={suppliers}
            projects={projects}
            categories={categoriesRes.data ?? []}
          />
          <div className="mt-5 border-t border-border pt-2">
            <List
              kind="payable"
              rows={(payablesRes.data ?? []) as Row[]}
              nameOf={(r) =>
                r.supplier_id ? supplierName.get(r.supplier_id) ?? null : null
              }
            />
          </div>
        </section>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{t("footnote")}</p>
    </div>
  );
}
