import { setRequestLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { resolveMonth } from "@/lib/social-report";
import { loadScope } from "../_data";
import { loadMonthReport } from "../_report";
import { ModuleShell } from "../_components/ModuleShell";
import { ReportView } from "../_components/ReportView";

export const dynamic = "force-dynamic";

export default async function SocialReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, scope, sp] = await Promise.all([
    getTranslations("social"),
    loadScope(searchParams),
    searchParams,
  ]);

  const rawMonth = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const month = resolveMonth(rawMonth, scope.today);
  const clientIds = scope.client
    ? [scope.client.id]
    : scope.clients.map((c) => c.id);

  const report = await loadMonthReport(clientIds, month);

  return (
    <>
      <PageHeader title={t("report.title")} subtitle={t("report.subtitle")} />
      <ModuleShell scope={scope} />
      <ReportView
        report={report}
        hrefFor={(m) =>
          `/social/report?m=${m}${scope.client ? `&client=${scope.client.slug}` : ""}`
        }
      />
    </>
  );
}
