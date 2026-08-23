import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

const IN_PRODUCTION = ["draft", "text_review", "creative_review"] as const;

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ProductionQueuePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("productionQueue");

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const [{ data: draftData }, { data: clientData }] = await Promise.all([
    supabase
      .from("content_drafts")
      .select("id, title, status, pillar, client_id, updated_at")
      .eq("tenant_id", tenantId)
      .in("status", IN_PRODUCTION)
      .order("updated_at", { ascending: true }),
    supabase.from("clients").select("id, name").eq("tenant_id", tenantId),
  ]);

  const drafts = draftData ?? [];
  const clientName = new Map((clientData ?? []).map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {drafts.map((d) => (
            <li key={d.id}>
              <Link
                href={`/content-engine/drafts/${d.id}/edit`}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {d.title}
                </span>
                <span className="hidden w-44 truncate text-muted-foreground sm:block">
                  {clientName.get(d.client_id) ?? "—"}
                  {d.pillar ? ` · ${d.pillar}` : ""}
                </span>
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] text-brand-soft-foreground">
                  {titleCase(d.status)}
                </span>
              </Link>
            </li>
          ))}
          {drafts.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("empty")}
            </li>
          )}
        </ul>
      </div>
    </>
  );
}
