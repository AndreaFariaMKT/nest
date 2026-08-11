import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function CommercialPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("commercial");

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const { data } = await supabase
    .from("clients")
    .select("id, name, slug, industry, status, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const clients = data ?? [];
  const prospects = clients.filter((c) => c.status === "prospect");
  const active = clients.filter((c) => c.status === "active").length;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label={t("prospects")} value={String(prospects.length)} />
        <Stat label={t("active")} value={String(active)} />
      </section>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {prospects.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clients/${c.slug}`}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {c.name}
                </span>
                <span className="hidden w-48 truncate text-muted-foreground sm:block">
                  {c.industry ?? "—"}
                </span>
                <span className="text-muted-foreground">
                  {dateFmt.format(new Date(c.created_at))}
                </span>
              </Link>
            </li>
          ))}
          {prospects.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("empty")}
            </li>
          )}
        </ul>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 font-display text-3xl leading-none text-foreground">
        {value}
      </div>
    </div>
  );
}
