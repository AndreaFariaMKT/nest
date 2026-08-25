import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import type { Route } from "next";

import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import {
  CHIP,
  MonthGrid,
  type CalendarEvent,
} from "@/components/calendar/MonthGrid";
import {
  MonthNav,
  monthFromParam,
  shiftMonth,
} from "@/components/calendar/MonthNav";
import { STAGE_TONE, type SocialStage } from "@/lib/social";
import { loadScope } from "../_data";
import { ModuleShell } from "../_components/ModuleShell";

export const dynamic = "force-dynamic";

const LEGEND: SocialStage[] = [
  "published",
  "scheduled",
  "approved",
  "client_review",
  "text_review",
  "draft",
];

export default async function SocialCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, scope, sp] = await Promise.all([
    getTranslations("social"),
    getFormatter(),
    loadScope(searchParams, "calendar"),
    searchParams,
  ]);
  // Carried into every piece link so pressing back returns to THIS screen,
  // with the client filter still applied.
  const backSuffix = scope.client ? `&client=${scope.client.slug}` : "";

  const month = monthFromParam(sp.m, scope.today);
  const inMonth = scope.pieces.filter((p) => p.publish_on?.startsWith(month));

  const events: CalendarEvent[] = inMonth.map((p) => ({
    id: p.id,
    day: p.publish_on!,
    label: p.title,
    title: `${scope.clientName(p.client_id)} · ${p.title}`,
    tone: STAGE_TONE[p.status],
    href: `/social/pieces/${p.id}?back=calendar${backSuffix}`,
  }));

  const link = (m: string) =>
    `/social/calendar?m=${m}${scope.client ? `&client=${scope.client.slug}` : ""}` as Route;

  const monthLabel = format.dateTime(new Date(`${month}-01T12:00:00Z`), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <>
      <PageHeader
        title={t("calendar.title")}
        subtitle={t("calendar.subtitle", {
          month: monthLabel,
          n: inMonth.length,
        })}
      />
      <ModuleShell scope={scope} />

      <MonthNav
        previousHref={link(shiftMonth(month, -1))}
        todayHref={link(scope.today.slice(0, 7))}
        nextHref={link(shiftMonth(month, 1))}
        previousLabel={t("report.previousMonth")}
        todayLabel={t("calendar.today")}
        nextLabel={t("report.nextMonth")}
        legend={LEGEND.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className={cn("h-2.5 w-2.5 rounded-sm", CHIP[STAGE_TONE[s]])}
            />
            {t(`stage.${s}`)}
          </span>
        ))}
      />

      <MonthGrid
        month={month}
        today={scope.today}
        events={events}
        emptyLabel={t("calendar.emptyMonth")}
      />
    </>
  );
}
