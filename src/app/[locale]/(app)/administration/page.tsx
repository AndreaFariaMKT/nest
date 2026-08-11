import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function AdministrationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("administration");
  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const [{ data: contracts }, { data: clients }] = await Promise.all([
    supabase.from("contracts").select("id, title, document_url, client_id, starts_on").eq("tenant_id", tenantId).not("document_url", "is", null).order("starts_on", { ascending: false }),
    supabase.from("clients").select("id, name").eq("tenant_id", tenantId),
  ]);
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const rows = contracts ?? [];
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <span className="font-medium text-foreground">{c.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">{clientName.get(c.client_id) ?? "—"}</span>
              </div>
              {c.document_url ? <a href={c.document_url} target="_blank" className="text-xs text-brand">{t("open")} →</a> : null}
            </li>
          ))}
          {rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">{t("empty")}</li>}
        </ul>
      </div>
    </>
  );
}
