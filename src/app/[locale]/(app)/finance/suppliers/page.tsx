import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { formatCentsAsBrl } from "@/lib/money";
import { fin, type SupplierRow } from "@/lib/finance-db";
import { SupplierForm } from "./SupplierForm";
import { deleteSupplierAction } from "./actions";

export const dynamic = "force-dynamic";

const noteTone = {
  collected: "success",
  pending: "warning",
  not_required: "muted",
} as const;

export default async function SuppliersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("finance.suppliers");

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const { data } = await fin(supabase)
    .from("fin_suppliers")
    .select(
      "id, name, category, doc_type, doc_number, pix_key, default_amount_cents, pay_day, note_status",
    )
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true })
    .limit(OPTION_LIST_CAP);

  const suppliers = (data ?? []) as SupplierRow[];
  const missingNote = suppliers.filter((s) => s.note_status === "pending");
  const byCpf = suppliers.filter((s) => s.doc_type === "cpf");

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("add")}
        </h2>
        <SupplierForm locale={locale} />
      </section>

      {suppliers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {suppliers.map((s) => (
            <li
              key={s.id}
              className="rounded-2xl border border-border bg-card p-5"
              data-testid="supplier-row"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[
                      s.category,
                      s.doc_type
                        ? `${s.doc_type.toUpperCase()} ${s.doc_number ?? ""}`.trim()
                        : null,
                      s.pay_day ? t("payDayShort", { day: s.pay_day }) : null,
                      s.default_amount_cents != null
                        ? formatCentsAsBrl(s.default_amount_cents)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <Pill tone={noteTone[s.note_status as keyof typeof noteTone] ?? "muted"}>
                  {t(`note.${s.note_status}`)}
                </Pill>
              </div>

              <SupplierForm locale={locale} supplier={s} />

              <form action={deleteSupplierAction} className="mt-3">
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  className="text-xs text-destructive underline underline-offset-4"
                >
                  {t("delete")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {/* The two things this screen exists to surface, said plainly rather than
          left for someone to notice by scanning badges. */}
      {missingNote.length > 0 || byCpf.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
          {missingNote.length > 0 ? (
            <p>{t("missingNotes", { count: missingNote.length })}</p>
          ) : null}
          {byCpf.length > 0 ? (
            <p className="mt-2">{t("cpfWarning", { count: byCpf.length })}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
