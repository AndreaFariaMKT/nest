import { setRequestLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { getPortalClient } from "@/lib/client-portal";
import { todayIso } from "@/lib/social";
import { resolveMonth } from "@/lib/social-report";
import { loadMonthReport } from "../../social/_report";
import { ReportView } from "../../social/_components/ReportView";
import { NotLinked } from "../_NotLinked";

export const dynamic = "force-dynamic";

export default async function PortalReport({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, ts, client, sp] = await Promise.all([
    getTranslations("portal"),
    getTranslations("social"),
    getPortalClient(),
    searchParams,
  ]);
  if (!client) return <NotLinked message={t("notLinked")} />;

  const rawMonth = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const month = resolveMonth(rawMonth, todayIso());
  const report = await loadMonthReport([client.id], month);

  return (
    <>
      <PageHeader
        title={ts("report.titlePortal")}
        subtitle={ts("report.subtitlePortal")}
      />
      <ReportView
        report={report}
        hrefFor={(m) => `/portal/report?m=${m}`}
      />
    </>
  );
}
