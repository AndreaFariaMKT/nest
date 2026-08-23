import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/client-portal";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotLinked } from "../_NotLinked";
import { formatCentsAsBrl } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PortalInvoices({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("portal");
  const client = await getPortalClient();
  if (!client) return <NotLinked message={t("notLinked")} />;

  const supabase = await createClient();
  const { data } = await supabase
    // The view, not the table (031): contracts.notes and document_url are
    // internal, and a row-level grant hands over the whole row.
    .from("portal_contract")
    .select("id, title, monthly_value_cents, starts_on, ends_on")
    .eq("client_id", client.id)
    .order("starts_on", { ascending: false });
  const rows = data ?? [];
  const df = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" });
  const fd = (d: string | null) => (d ? df.format(new Date(d)) : "—");

  return (
    <>
      <PageHeader title={t("invoices.title")} subtitle={t("invoices.subtitle")} />
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <span className="font-medium text-foreground">{c.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">{fd(c.starts_on)} → {fd(c.ends_on)}</span>
              </div>
              <span className="text-foreground">{formatCentsAsBrl(c.monthly_value_cents ?? 0)}</span>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">{t("invoices.empty")}</li>
          )}
        </ul>
      </div>
    </>
  );
}
