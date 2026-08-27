import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { PIPELINE_STAGES, stageOf } from "@/lib/pipeline";
import { ProspectCard, type Prospect } from "./ProspectCard";

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
    .select("id, name, slug, industry, status, created_at, pipeline_stage")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(OPTION_LIST_CAP);

  const clients = (data ?? []) as Array<Prospect & { created_at: string }>;
  const prospects = clients.filter((c) => c.status === "prospect");
  const active = clients.filter((c) => c.status === "active").length;

  // Grouped by stage rather than listed by date. The stages ARE a sequence —
  // a conversation goes new → contacted → proposal → negotiation — so the
  // order across the board carries information the reader needs, which a flat
  // list sorted by creation date threw away.
  const byStage = new Map(PIPELINE_STAGES.map((s) => [s, [] as Prospect[]]));
  for (const p of prospects) byStage.get(stageOf(p.pipeline_stage))!.push(p);

  // `lost` sits apart: it is an exit, not a step, and mixing it into the run
  // of open stages makes the board read as five steps rather than four.
  const lost = byStage.get("lost")!;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label={t("prospects")} value={String(prospects.length)} />
        <Stat label={t("active")} value={String(active)} />
      </section>

      <h2 className="mb-3 font-display text-xl leading-snug">{t("pipeline.board")}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PIPELINE_STAGES.filter((st) => st !== "lost").map((st) => (
          <section key={st} className="rounded-2xl border border-border bg-muted/30 p-3">
            <h3 className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`pipeline.stage.${st}`)}
              <span className="tabular-nums">{byStage.get(st)!.length}</span>
            </h3>
            <div className="space-y-2">
              {byStage.get(st)!.map((p) => (
                <ProspectCard key={p.id} prospect={p} locale={locale} />
              ))}
              {byStage.get(st)!.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                  {t("pipeline.stageEmpty")}
                </p>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      {lost.length ? (
        <section className="mt-8">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("pipeline.stage.lost")} · {lost.length}
          </h3>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {lost.map((p) => (
              <ProspectCard key={p.id} prospect={p} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      {prospects.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : null}

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
