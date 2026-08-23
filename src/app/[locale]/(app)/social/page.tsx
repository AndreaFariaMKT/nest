import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/routing";
import type { Route } from "next";

import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils";
import {
  formatIsoDate,
  addDays,
  clientHealth,
  type HealthLevel,
  fortnightOf,
  FORTNIGHT_ANCHOR,
  socialScreensFor,
  type SocialPiece,
} from "@/lib/social";
import { loadScope } from "./_data";
import { ModuleShell } from "./_components/ModuleShell";

export const dynamic = "force-dynamic";

const DOT: Record<HealthLevel, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-destructive",
};
const EDGE: Record<HealthLevel, string> = {
  ok: "border-l-emerald-500",
  warn: "border-l-amber-500",
  bad: "border-l-destructive",
};

export default async function SocialOverview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("social");
  const scope = await loadScope(searchParams);

  // The sidebar links every module role at /social, but this screen is built
  // for whoever runs the fortnight. Send everyone else to the first screen they
  // actually hold, rather than showing them an overview with an empty nav.
  if (!scope.caps.includes("direction") && !scope.caps.includes("coordinate")) {
    const first = socialScreensFor(scope.role)[0];
    redirect({
      href: (first?.href ?? "/today") as "/social/production",
      locale: locale as "pt-BR" | "en",
    });
  }

  const fortnight = fortnightOf(scope.today, FORTNIGHT_ANCHOR);

  const shown = scope.client
    ? scope.clients.filter((c) => c.id === scope.client!.id)
    : scope.clients;

  return (
    <>
      <PageHeader title={t("overview.title")} subtitle={t("overview.subtitle")} />
      <ModuleShell scope={scope} />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {t("overview.clients")}
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {t("overview.clientsLegend")}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((c) => {
              const pieces = scope.allPieces.filter((p) => p.client_id === c.id);
              const h = clientHealth(
                pieces as SocialPiece[],
                c.posts_per_cycle,
                scope.today,
              );
              return (
                <Link
                  key={c.id}
                  href={`/social/backlog?client=${c.slug}` as Route}
                  className={cn(
                    "rounded-xl border border-l-4 border-border bg-background p-4 transition-colors hover:border-brand",
                    EDGE[h.level],
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {c.name}
                    </span>
                    <span
                      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT[h.level])}
                    />
                  </div>
                  <p className="min-h-[2rem] text-xs leading-relaxed text-muted-foreground">
                    {t(`health.${h.reason}`, { count: h.count })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
                    <span>{t("overview.statBacklog", { n: h.stock.count })}</span>
                    <span>{t("overview.statWithClient", { n: h.withClient })}</span>
                    <span>{t("overview.statLive", { n: h.live })}</span>
                  </div>
                </Link>
              );
            })}
            {shown.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground sm:col-span-2">
                {t("overview.noClients")}
              </p>
            ) : null}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("overview.fortnight")}
            </h2>

            <div className="rounded-xl border border-brand bg-muted/40 p-4">
              <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-widest text-brand">
                <span>{t("rhythm.sendingWeek")}</span>
                <span className="text-muted-foreground">
                  {formatIsoDate(fortnight.start, locale)} →{" "}
                  {formatIsoDate(fortnight.sendingWeekEnd, locale)}
                </span>
              </div>
              {["mon", "wed", "thu", "fri"].map((d) => (
                <p key={d} className="py-0.5 text-xs leading-relaxed text-muted-foreground">
                  {t(`rhythm.sending.${d}`)}
                </p>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-border p-4">
              <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                <span>{t("rhythm.productionWeek")}</span>
                <span>
                  {formatIsoDate(addDays(fortnight.start, 7), locale)} →{" "}
                  {formatIsoDate(fortnight.end, locale)}
                </span>
              </div>
              {["mon", "thu", "fri"].map((d) => (
                <p key={d} className="py-0.5 text-xs leading-relaxed text-muted-foreground">
                  {t(`rhythm.production.${d}`)}
                </p>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-muted/40 p-5">
            <h2 className="mb-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("rhythm.creedTitle")}
            </h2>
            {["one", "two", "three"].map((k) => (
              <p
                key={k}
                className="border-b border-border py-2 font-display text-base leading-snug last:border-0"
              >
                {t(`rhythm.creed.${k}`)}
              </p>
            ))}
            <div className="mt-3 space-y-1 text-xs leading-relaxed text-muted-foreground">
              <p>{t("rhythm.datedRequest")}</p>
              <p>{t("rhythm.undatedIdea")}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill tone="brand" className="text-[10px]">
                {t("rhythm.replyWindow")}
              </Pill>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
