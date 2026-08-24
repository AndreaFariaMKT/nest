import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils";
import { formatIsoDate, backlogStock, IN_FLIGHT_STAGES } from "@/lib/social";
import { loadScope, type SocialPieceRow } from "../_data";
import { ModuleShell } from "../_components/ModuleShell";
import { StageBadge } from "../_components/StageBadge";
import { ThemeForm } from "../_components/ThemeForm";
import { EmptyAction, EmptyState, ModuleNote, SectionTitle } from "../_components/Shared";

export const dynamic = "force-dynamic";

export default async function BacklogPage({
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
  const perCycle = scope.client
    ? scope.client.posts_per_cycle
    : scope.clients.reduce((s, c) => s + c.posts_per_cycle, 0) || 1;

  const shelf = scope.pieces.filter((p) => p.status === "backlog");
  // Rejected pieces have their own section above; counting them here too
  // listed every one twice and inflated "in the flow".
  const pulled = scope.pieces.filter(
    (p) => IN_FLIGHT_STAGES.includes(p.status) && p.status !== "rejected",
  );
  const gone = scope.pieces.filter((p) => p.status === "published");
  const returned = scope.pieces.filter((p) => p.status === "rejected");
  const stock = backlogStock(shelf.length, perCycle);

  // The meter tops out at three fortnights — past that the shelf is not the
  // thing to worry about.
  const fill = Math.min(100, (stock.fortnights / 3) * 100);

  return (
    <>
      <PageHeader title={t("backlog.title")} subtitle={t("backlog.subtitle")} />
      <ModuleShell scope={scope} />

      {scope.caps.includes("coordinate") ? (
        scope.clients.length === 0 ? (
          // The form rendered regardless, building its client dropdown from an
          // empty array: nine fields, a submit, and a refusal from a select
          // that had no way to not be empty. The switch is on the client
          // record, so send her there instead.
          <EmptyState action={
            <EmptyAction href="/clients">
              {t("overview.moduleOffAction")}
            </EmptyAction>
          }>
            {t("overview.noClients")}
          </EmptyState>
        ) : (
          <ThemeForm
            locale={locale}
            clients={scope.clients.map((c) => ({ id: c.id, name: c.name }))}
            defaultClient={scope.client?.id}
          />
        )
      ) : null}

      <section className="mb-4 rounded-2xl bg-muted/50 p-5" data-testid="social-stock">
        <div className="relative h-1.5 rounded-full bg-background">
          <div
            className={cn(
              "h-1.5 rounded-full transition-[width]",
              stock.low ? "bg-destructive" : "bg-brand",
            )}
            style={{ width: `${fill}%` }}
          />
          {/* Two fortnights is the restock line. */}
          <span
            className="absolute -top-1 h-3.5 w-px bg-foreground/30"
            style={{ left: "66.6%" }}
          />
          <span
            className="absolute -top-1 pl-2 text-[10px] uppercase tracking-widest text-muted-foreground"
            style={{ left: "66.6%" }}
          >
            {t("backlog.twoFortnights")}
          </span>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          {t("backlog.stock", {
            n: stock.count,
            per: stock.perCycle,
          })}{" "}
          ·{" "}
          {stock.low ? (
            <span className="font-medium text-destructive">
              {t("backlog.restock")}
            </span>
          ) : (
            <span>{t("backlog.comfortable")}</span>
          )}
        </p>
      </section>

      {returned.length ? (
        <section className="mb-4 rounded-2xl border border-border bg-card">
          <SectionTitle
            title={t("backlog.cameBack")}
            hint={t("backlog.cameBackHint")}
          />
          <List pieces={returned} name={scope.clientName} locale={locale} />
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card">
          <SectionTitle
            title={t("backlog.available")}
            hint={t("backlog.count", { n: shelf.length })}
          />
          <List
            pieces={shelf}
            name={scope.clientName}
            locale={locale}
            empty={t("backlog.emptyShelf")}
          />
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-card">
            <SectionTitle
              title={t("backlog.pulled")}
              hint={t("backlog.inFlow", { n: pulled.length })}
            />
            <List
              pieces={pulled}
              name={scope.clientName}
              locale={locale}
              empty={t("backlog.emptyPulled")}
            />
          </section>

          <section className="rounded-2xl border border-border bg-muted/40">
            <SectionTitle
              title={t("backlog.offShelf")}
              hint={t("backlog.publishedCount", { n: gone.length })}
            />
            <ul className="divide-y divide-border px-5 pb-4">
              {gone.slice(0, 8).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatIsoDate(p.publish_on, locale) ?? "—"}
                  </span>
                </li>
              ))}
              {gone.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  {t("backlog.emptyPublished")}
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      </div>

      <ModuleNote>
        {t("backlog.note")}
      </ModuleNote>
    </>
  );
}

function List({
  pieces,
  name,
  locale,
  empty,
}: {
  pieces: SocialPieceRow[];
  name: (id: string) => string;
  locale: string;
  empty?: string;
}) {
  if (!pieces.length) {
    return (
      <p className="px-5 py-8 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border px-5 pb-4">
      {pieces.map((p) => (
        <li key={p.id}>
          <Link
            href={`/social/pieces/${p.id}` as Route}
            className="flex items-center gap-3 py-3 transition-colors hover:opacity-80"
          >
            <Pill tone="brand" className="shrink-0 text-[10px]">
              {name(p.client_id).slice(0, 2).toUpperCase()}
            </Pill>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">
                {p.title}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {[name(p.client_id), p.pillar, formatIsoDate(p.backlog_added_on, locale)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <StageBadge stage={p.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
