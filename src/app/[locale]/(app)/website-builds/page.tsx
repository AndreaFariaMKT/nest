import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

export const dynamic = "force-dynamic";

export default async function WebsiteBuildsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("websiteBuilds");
  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const { data } = await supabase.from("clients").select("id, name, slug, website, status").eq("tenant_id", tenantId).not("website", "is", null).order("name", { ascending: true });
  const rows = data ?? [];
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
              {/* The slug was already in the select, unused. */}
              <Link
                href={`/clients/${c.slug}` as Route}
                className="font-medium text-foreground hover:text-brand hover:underline"
              >
                {c.name}
              </Link>
              <a href={c.website ?? "#"} target="_blank" className="truncate text-xs text-brand">{(c.website ?? "").replace(/^https?:\/\//, "")}</a>
            </li>
          ))}
          {rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">{t("empty")}</li>}
        </ul>
      </div>
    </>
  );
}
