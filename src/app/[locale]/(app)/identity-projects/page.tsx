import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Link } from "@/i18n/routing";
import type { Route } from "next";
import type { BrandColor } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function IdentityProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("identityProjects");
  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const [{ data: kits }, { data: clients }] = await Promise.all([
    supabase.from("brand_kits").select("id, name, palette, guidelines_url, client_id").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(OPTION_LIST_CAP),
    supabase.from("clients").select("id, name, slug").eq("tenant_id", tenantId).limit(OPTION_LIST_CAP),
  ]);
  // This printed the client as dead text; a duplicate index screen at
  // /brand-kits linked them correctly and was reachable from nowhere. That
  // screen is gone and this one links.
  const clientOf = new Map(
    (clients ?? []).map((c) => [c.id, { name: c.name, slug: c.slug }]),
  );
  const rows = kits ?? [];
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-8 py-16 text-center text-sm text-muted-foreground">{t("empty")}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((k) => {
            const palette = (Array.isArray(k.palette) ? k.palette : []) as unknown as BrandColor[];
            return (
              <div key={k.id} className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs text-muted-foreground">
                  {clientOf.get(k.client_id)?.name ?? "—"}
                </p>
                {clientOf.has(k.client_id) ? (
                  <Link
                    href={
                      `/clients/${clientOf.get(k.client_id)!.slug}/brand-kit` as Route
                    }
                    className="mt-0.5 block font-medium text-foreground hover:text-brand hover:underline"
                  >
                    {k.name}
                  </Link>
                ) : (
                  <h3 className="mt-0.5 font-medium text-foreground">{k.name}</h3>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {palette.slice(0, 8).map((c, i) => (
                    <span key={i} className="h-6 w-6 rounded-md border border-border" style={{ backgroundColor: c.hex }} title={c.name} />
                  ))}
                </div>
                {k.guidelines_url ? (
                  <a href={k.guidelines_url} target="_blank" className="mt-3 inline-block text-xs text-brand">{t("guidelines")} →</a>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
