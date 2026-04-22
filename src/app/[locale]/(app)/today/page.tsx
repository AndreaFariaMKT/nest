import { setRequestLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isOwner } from "@/lib/auth";
import { formatCentsAsBrl, sumCents } from "@/lib/money";

export default async function TodayPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("today");

  const profile = await getCurrentProfile();
  const firstName = (profile?.full_name ?? "").split(" ")[0] || "";

  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const ownerView = await isOwner();
  let activeClients = 0;
  let activeServices = 0;
  let mrrCents = 0;
  if (ownerView) {
    const supabase = await createClient();

    const { count } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    activeClients = count ?? 0;

    const { count: serviceCount } = await supabase
      .from("client_services")
      .select("client_id", { count: "exact", head: true })
      .is("ended_on", null);
    activeServices = serviceCount ?? 0;

    const today = new Date().toISOString().slice(0, 10);
    const { data: contracts } = await supabase
      .from("contracts")
      .select("monthly_value_cents, starts_on, ends_on")
      .lte("starts_on", today)
      .or(`ends_on.is.null,ends_on.gte.${today}`);
    mrrCents = sumCents(
      (contracts ?? []).map((c) => c.monthly_value_cents),
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-10">
        <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
        <h1 className="mt-1 font-display text-4xl text-foreground">
          {firstName ? t("greeting", { name: firstName }) : t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {ownerView ? (
        <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Stat label={t("stats.activeClients")} value={String(activeClients)} />
          <Stat
            label={t("stats.activeServices")}
            value={String(activeServices)}
          />
          <Stat
            label={t("stats.monthlyRevenue")}
            value={formatCentsAsBrl(mrrCents)}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SkeletonCard
          title={t("blocks.tasks.title")}
          hint={t("blocks.tasks.hint")}
        />
        <SkeletonCard
          title={t("blocks.meetings.title")}
          hint={t("blocks.meetings.hint")}
        />
        <SkeletonCard
          title={t("blocks.approvals.title")}
          hint={t("blocks.approvals.hint")}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border border-border bg-card p-5"
      data-testid="today-stat"
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl text-foreground">{value}</div>
    </div>
  );
}

function SkeletonCard({ title, hint }: { title: string; hint: string }) {
  return (
    <Card data-testid="today-block">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}

export const dynamic = "force-dynamic";
