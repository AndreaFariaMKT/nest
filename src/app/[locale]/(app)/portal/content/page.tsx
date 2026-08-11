import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/client-portal";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotLinked } from "../_NotLinked";

export const dynamic = "force-dynamic";

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function PortalContent({
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
    .from("content_drafts")
    .select("id, title, status, pillar")
    .eq("client_id", client.id)
    .in("status", ["client_review", "approved", "scheduled", "published"])
    .order("updated_at", { ascending: false });
  const drafts = data ?? [];

  return (
    <>
      <PageHeader title={t("content.title")} subtitle={t("content.subtitle")} />
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {drafts.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{d.title}</span>
              {d.pillar ? <span className="hidden text-muted-foreground sm:block">{d.pillar}</span> : null}
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] text-brand-soft-foreground">{titleCase(d.status)}</span>
            </li>
          ))}
          {drafts.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">{t("content.empty")}</li>
          )}
        </ul>
      </div>
    </>
  );
}
