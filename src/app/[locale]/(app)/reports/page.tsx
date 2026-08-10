import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import type { Database } from "@/types/database";
import { monthLabel } from "@/lib/monthly-report";

type Report = Database["public"]["Tables"]["monthly_reports"]["Row"];
type JoinedReport = Report & {
  client:
    | { name: string; slug: string }
    | Array<{ name: string; slug: string }>
    | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("reports");

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const { data } = await supabase
    .from("monthly_reports")
    .select("*, client:clients(name, slug)")
    .eq("tenant_id", tenantId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .order("generated_at", { ascending: false })
    .limit(30);
  const reports = (data ?? []) as unknown as JoinedReport[];

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-4xl text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-border">
        <span className="-mb-px border-b-2 border-foreground px-3 py-2 text-sm font-medium">
          {t("monthlyTab")}
        </span>
        <Link
          href="/reports/kpi"
          className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:border-border hover:text-foreground"
        >
          {t("kpiTab")}
        </Link>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("listEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => {
            const client = pickOne(r.client);
            const content = (r.content ?? {}) as {
              summary?: string;
            };
            return (
              <li key={r.id}>
                <Link
                  href={`/reports/${r.id}`}
                  className="block rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-muted"
                  data-testid="report-row"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">
                      {client?.name ?? "—"} · {monthLabel(r.year, r.month, locale)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "short",
                      }).format(new Date(r.generated_at))}
                    </span>
                  </div>
                  {content.summary ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {content.summary}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
