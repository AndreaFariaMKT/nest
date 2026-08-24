import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { formatLabel } from "@/lib/social";
import { createClient } from "@/lib/supabase/server";
import { loadScope } from "../_data";
import { ModuleShell } from "../_components/ModuleShell";
import { StageBadge } from "../_components/StageBadge";
import { CopyText } from "../_components/CopyText";
import { BuildOrderButton } from "../_components/PieceActions";
import { Moves } from "../_components/Moves";
import { EmptyState, ModuleNote } from "../_components/Shared";

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
  const scope = await loadScope(searchParams, "publishing");
  // Carried into every piece link so pressing back returns to THIS screen,
  // with the client filter still applied.
  const backSuffix = scope.client ? `&client=${scope.client.slug}` : "";
  const approved = scope.pieces.filter((p) => p.status === "approved");
  const order = scope.pieces
    .filter((p) => p.status === "scheduled" || p.status === "published")
    .sort((a, b) => (a.publish_on ?? "9999").localeCompare(b.publish_on ?? "9999"));
  const toGo = order.filter((p) => p.status === "scheduled").length;

  // Which pieces can go out without a person. A piece publishes on its own
  // only when it has artwork attached; the rest are posted by hand and marked
  // live here. This screen is where the order gets built, so it is where that
  // difference has to be visible — the worst outcome in this whole flow is
  // someone believing a post is scheduled when nothing will send it.
  const supabase = await createClient();
  //
  // Asked of content_drafts, not of slides. Querying `slides` directly returns
  // one row PER IMAGE — up to ten per piece — against PostgREST's silent
  // 1000-row cap, and the set here is cumulative: every approved, scheduled
  // and published piece the tenant has ever made. A hundred artworked pieces
  // is one year of use and a thousand slide rows, and past the cap pieces drop
  // out of this Set silently: they render "by hand" and the count undercounts.
  // That is the same truncation listPieces was hardened against, and it would
  // produce exactly the failure this screen exists to prevent.
  //
  // Bounded by the piece count instead — the shape enqueueForPublish uses.
  const ids = [...approved, ...order].map((p) => p.id);
  const automatic = new Set<string>();
  if (ids.length) {
    const { data: withArt } = await supabase
      .from("content_drafts")
      .select("id, slides(id)")
      .in("id", ids);
    for (const row of withArt ?? []) {
      if ((row.slides as unknown[] | null)?.length) automatic.add(row.id);
    }
  }
  // Artwork is necessary and was treated as sufficient. It is not: the cron
  // also needs an enabled account with a stored secret for every channel the
  // piece targets, and without one it records `no_account` and flips the row
  // to `failed`. So a piece with ten images and no connected Instagram read
  // "will publish on its own" on the one screen built to make that difference
  // visible. Presence only — nothing is decrypted here.
  const { data: accountRows } = scope.clients.length
    ? await supabase
        .from("client_social_accounts")
        .select("client_id, platform, enabled, secret_enc, account_ref")
        // Scoped by the client list rather than by tenant: the scope holds the
        // clients this reader may see, and the table's RLS is
        // has_client_access, so asking per-client matches the permission model.
        .in(
          "client_id",
          scope.clients.map((c) => c.id),
        )
    : { data: [] };
  const connected = new Set(
    (accountRows ?? [])
      .filter((a) => a.enabled && a.secret_enc && a.account_ref)
      .map((a) => `${a.client_id}:${a.platform}`),
  );
  const canSend = (piece: (typeof order)[number]) =>
    piece.channels.length > 0 &&
    piece.channels.every((c) => connected.has(`${piece.client_id}:${c}`));

  const approvedAuto = approved.filter(
    (p) => automatic.has(p.id) && canSend(p),
  ).length;
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
            {t("publishing.notInOrder", { n: approved.length })}{" "}
            {approvedAuto
              ? t("publishing.ofWhichAutomatic", {
                  n: approvedAuto,
                  manual: approved.length - approvedAuto,
                })
              : t("publishing.allManual")}
          </p>
          <BuildOrderButton
            locale={locale}
            clientId={scope.client?.id}
            label={t("publishing.buildOrder")}
            confirmLabel={t("publishing.buildOrderConfirm", {
              n: approved.length,
            })}
          />
        </div>
      ) : null}

      <ModuleNote>
        {t("publishing.note")}
      </ModuleNote>

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
                {scope.clientName(p.client_id)}
              </Pill>
              <span className="text-xs text-muted-foreground">
                {formatLabel(p.post_type, p.slide_count, (k) => t(`format.${k}`))}{" "}
                · {p.channels.map((c) => t(`channel.${c}`)).join(" + ")}
              </span>
              <StageBadge stage={p.status} />
              {p.status === "scheduled" ? (
                automatic.has(p.id) && !canSend(p) ? (
                  // Has the artwork, has no account: the one case that used to
                  // read as "will publish on its own" and would not have.
                  <Pill tone="warning" className="text-[10px]">
                    {t("publishing.noAccount")}
                  </Pill>
                ) : (
                  <Pill
                    tone={automatic.has(p.id) ? "brand" : "muted"}
                    className="text-[10px]"
                  >
                    {automatic.has(p.id)
                      ? t("publishing.willSend")
                      : t("publishing.byHand")}
                  </Pill>
                )
              ) : null}
            </header>

            <Link
              href={`/social/pieces/${p.id}?back=publishing${backSuffix}` as Route}
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
                  <Moves
                    piece={p}
                    caps={scope.caps}
                    today={scope.today}
                    locale={locale}
                  />
                </span>
              ) : null}
            </div>
          </article>
        ))}

        {order.length === 0 ? (
          <EmptyState>
            {t("publishing.empty")}
          </EmptyState>
        ) : null}
      </div>
    </>
  );
}
