import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function MarketingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketing");

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const { data } = await supabase
    .from("content_drafts")
    .select("pillar, status")
    // Social pieces only — the marketing stats.
    .eq("engine", "social")
    .eq("tenant_id", tenantId);

  const drafts = data ?? [];
  const published = drafts.filter((d) => d.status === "published").length;
  const scheduled = drafts.filter((d) => d.status === "scheduled").length;

  const pillarCounts = new Map<string, number>();
  for (const d of drafts) {
    const p = d.pillar?.trim() || t("noPillar");
    pillarCounts.set(p, (pillarCounts.get(p) ?? 0) + 1);
  }
  const pillars = [...pillarCounts.entries()].sort((a, b) => b[1] - a[1]);
  const max = pillars[0]?.[1] ?? 1;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label={t("totalDrafts")} value={String(drafts.length)} />
        <Stat label={t("published")} value={String(published)} />
        <Stat label={t("scheduled")} value={String(scheduled)} />
      </section>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("byPillar")}
        </h2>
        {pillars.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {pillars.map(([pillar, count]) => (
              <li key={pillar}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-foreground">{pillar}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.round((count / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
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
