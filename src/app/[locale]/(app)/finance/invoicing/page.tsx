import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { formatCents } from "@/lib/money";
import { todayIso } from "@/lib/social";
import {
  INVOICE_DEADLINE_BUSINESS_DAYS,
  invoiceQueue,
} from "@/lib/invoicing";
import {
  type ReceivableRow } from "@/lib/finance-db";
import { setInvoiceStatusAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function InvoicingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("finance.invoicing");

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const today = todayIso();

  const [{ data: receivableData }, { data: clientData }] = await Promise.all([
    supabase.from("fin_receivables")
      .select(
        "id, client_id, project_id, description, amount_cents, currency, due_on, paid_on, date_accrual, status, invoice_status",
      )
      .eq("tenant_id", tenantId)
      .not("paid_on", "is", null)
      .order("paid_on", { ascending: false })
      .limit(OPTION_LIST_CAP),
    supabase
      .from("clients")
      .select("id, name, country")
      .eq("tenant_id", tenantId)
      .limit(OPTION_LIST_CAP),
  ]);

  const clients = clientData ?? [];
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const rows = ((receivableData ?? []) as ReceivableRow[]).map((r) => ({
    ...r,
    country: r.client_id ? clientById.get(r.client_id)?.country ?? null : null,
    client_name: r.client_id ? clientById.get(r.client_id)?.name ?? null : null,
  }));

  const { due, exports } = invoiceQueue(rows, today);

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="mb-6 rounded-2xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{t("rulesTitle")}</p>
        <ul className="mt-2 space-y-1">
          <li>{t("rule1")}</li>
          <li>{t("rule2", { days: INVOICE_DEADLINE_BUSINESS_DAYS })}</li>
          <li>{t("rule3")}</li>
        </ul>
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("queue")} · {due.length}
        </h2>
        {due.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            {t("queueEmpty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {due.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-border bg-card p-4"
                data-testid="invoice-row"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {row.client_name ?? t("noClient")}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {row.description} · {t("paidOn", { date: row.paid_on ?? "—" })}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Pill tone={row.late ? "danger" : "warning"}>
                      {row.late
                        ? t("late")
                        : t("dueOn", { date: row.due_on })}
                    </Pill>
                    <span className="tabular-nums">
                      {/* In the row's own currency. This half of the screen
                          used formatCentsAsBrl while the export list twelve
                          lines below used formatCents — the same column,
                          rendered two ways, and the queue was the one that got
                          a dollar amount wrong. */}
                      {formatCents(row.amount_cents, row.currency)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  {row.invoice_status === "pending" ? (
                    <form action={setInvoiceStatusAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="status" value="requested" />
                      <button
                        type="submit"
                        className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
                      >
                        {t("markRequested")}
                      </button>
                    </form>
                  ) : null}
                  <form
                    action={setInvoiceStatusAction}
                    className="flex items-end gap-2"
                  >
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="status" value="issued" />
                    <label className="text-xs text-muted-foreground">
                      {t("ref")}
                      <input
                        name="invoice_ref"
                        className="mt-1 block h-9 rounded-md border border-input bg-background px-2 text-sm"
                        placeholder="NFS-e"
                      />
                    </label>
                    <button
                      type="submit"
                      className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      {t("markIssued")}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Shown, not filtered away: a row that vanishes from a to-do list looks
          like a row that was forgotten. */}
      {exports.length > 0 ? (
        <section>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("exportsTitle")} · {exports.length}
          </h2>
          <ul className="space-y-2">
            {exports.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate">
                    {row.client_name ?? t("noClient")}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.description}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Pill tone="muted">{t("exportBadge")}</Pill>
                  <span className="tabular-nums">
                    {formatCents(row.amount_cents, row.currency)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{t("exportsHint")}</p>
        </section>
      ) : null}
    </div>
  );
}
