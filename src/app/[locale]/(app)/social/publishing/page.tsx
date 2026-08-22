import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { formatLabel } from "@/lib/social";
import { loadScope } from "../_data";
import { ModuleShell } from "../_components/ModuleShell";
import { StageBadge } from "../_components/StageBadge";
import { CopyText } from "../_components/CopyText";
import { BuildOrderButton, QuickAction } from "../_components/PieceActions";

export const dynamic = "force-dynamic";

export default async function PublishingPage({
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
  const name = (id: string) =>
    scope.clients.find((c) => c.id === id)?.name ?? "—";

  const approved = scope.pieces.filter((p) => p.status === "approved");
  const order = scope.pieces
    .filter((p) => p.status === "scheduled" || p.status === "published")
    .sort((a, b) => (a.publish_on ?? "9999").localeCompare(b.publish_on ?? "9999"));
  const toGo = order.filter((p) => p.status === "scheduled").length;
  const live = order.filter((p) => p.status === "published").length;

  return (
    <>
      <PageHeader
        title={t("publishing.title")}
        subtitle={t("publishing.subtitle")}
      />
      <ModuleShell scope={scope} />

      <div className="mb-4 flex justify-end">
        <Pill tone={toGo ? "brand" : "success"}>
          {t("publishing.counter", { live, toGo })}
        </Pill>
      </div>

      {approved.length && scope.caps.includes("publish") ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3">
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">
            {t("publishing.notInOrder", { n: approved.length })}
          </p>
          <BuildOrderButton
            locale={locale}
            clientId={scope.client?.id}
            label={t("publishing.buildOrder")}
          />
        </div>
      ) : null}

      <p className="mb-4 rounded-xl border-l-2 border-brand bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        {t("publishing.note")}
      </p>

      <div className="space-y-3">
        {order.map((p) => (
          <article
            key={p.id}
            className={`rounded-2xl border border-border p-5 ${
              p.status === "published" ? "bg-muted/40 opacity-75" : "bg-card"
            }`}
          >
            <header className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-display text-base text-brand">
                {p.publish_on ?? "—"} · {p.publish_time.slice(0, 5)}
              </span>
              <Pill tone="muted" className="text-[10px]">
                {name(p.client_id)}
              </Pill>
              <span className="text-xs text-muted-foreground">
                {formatLabel(p.post_type, p.slide_count, (k) => t(`format.${k}`))}{" "}
                · {p.channels.map((c) => t(`channel.${c}`)).join(" + ")}
              </span>
              <StageBadge stage={p.status} />
            </header>

            <Link
              href={`/social/pieces/${p.id}` as Route}
              className="text-sm font-medium text-foreground hover:underline"
            >
              {p.title}
            </Link>

            {p.note_publish ? (
              <p className="mt-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                {p.note_publish}
              </p>
            ) : null}

            {p.caption ? (
              <pre className="mt-3 max-h-28 overflow-hidden whitespace-pre-wrap rounded-lg bg-muted/60 px-4 py-3 font-sans text-xs leading-relaxed text-muted-foreground">
                {p.caption}
              </pre>
            ) : (
              <p className="mt-3 text-xs text-destructive">
                {t("publishing.noText")}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {p.caption ? (
                <CopyText
                  text={p.caption}
                  label={t("publishing.copyText")}
                  copiedLabel={t("publishing.copied")}
                />
              ) : null}
              <span className="text-xs text-muted-foreground">
                {p.material_url ?? t("publishing.noFolder")}
              </span>
              {scope.caps.includes("publish") ? (
                <span className="ml-auto">
                  {p.status === "published" ? (
                    <QuickAction
                      id={p.id}
                      locale={locale}
                      action="unmark_live"
                      label={t("publishing.undo")}
                    />
                  ) : (
                    <QuickAction
                      id={p.id}
                      locale={locale}
                      action="mark_live"
                      label={t("publishing.markLive")}
                      variant="primary"
                    />
                  )}
                </span>
              ) : null}
            </div>
          </article>
        ))}

        {order.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
            {t("publishing.empty")}
          </p>
        ) : null}
      </div>
    </>
  );
}
