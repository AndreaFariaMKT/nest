import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/client-portal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import {
  CLIENT_VISIBLE_STAGES,
  isReplyOverdue,
  replyDueBy,
  todayIso,
} from "@/lib/social";
import { PIECE_COLUMNS, type PieceRecord } from "../../social/_data";
import { PieceCard } from "../../social/_components/PieceCard";
import { DecisionForm } from "../../social/_components/PieceActions";
import { CycleFeedback } from "./CycleFeedback";
import { NotLinked } from "../_NotLinked";

export const dynamic = "force-dynamic";

export default async function PortalContent({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, ts, client] = await Promise.all([
    getTranslations("portal"),
    getTranslations("social"),
    getPortalClient(),
  ]);
  if (!client) return <NotLinked message={t("notLinked")} />;

  const today = todayIso();
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_drafts")
    .select(PIECE_COLUMNS)
    .eq("client_id", client.id)
    .in("status", CLIENT_VISIBLE_STAGES)
    .order("publish_on", { ascending: true, nullsFirst: false });

  const pieces = (data ?? []) as unknown as PieceRecord[];
  const waiting = pieces.filter(
    (p) => p.status === "client_review" || p.status === "changes_requested",
  );

  return (
    <>
      <PageHeader
        title={t("content.title")}
        subtitle={ts("portal.contentSubtitle")}
      />

      <div className="mb-4 flex items-center justify-end">
        <Pill tone={waiting.length ? "warning" : "success"}>
          {waiting.length
            ? ts("portal.waitingCount", { n: waiting.length })
            : ts("portal.allReviewed")}
        </Pill>
      </div>

      <p className="mb-5 rounded-xl border-l-2 border-brand bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        {ts("portal.howItWorks")}
      </p>

      {pieces.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
          {t("content.empty")}
        </p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pieces.map((p) => {
            const decidable =
              p.status === "client_review" || p.status === "changes_requested";
            const due = replyDueBy(p.publish_on);
            return (
              <PieceCard
                key={p.id}
                piece={p}
                clientName={client.name}
                today={today}
                href={`/portal/content#${p.id}`}
              >
                {decidable ? (
                  <>
                    <p className="mb-3 text-xs text-muted-foreground">
                      {isReplyOverdue(p.publish_on, today)
                        ? ts("portal.pastDue")
                        : ts("portal.dueOn", { date: due ?? "" })}
                    </p>
                    <DecisionForm
                      id={p.id}
                      locale={locale}
                      commentLabel={ts("portal.commentLabel")}
                      commentHint={ts("portal.commentHint")}
                      commentPlaceholder={ts("portal.commentPlaceholder")}
                      choices={[
                        {
                          action: "client_reject",
                          label: ts("portal.notApproved"),
                          variant: "danger",
                        },
                        {
                          action: "client_request_changes",
                          label: ts("portal.approveWithChanges"),
                        },
                        {
                          action: "client_approve",
                          label: ts("portal.approve"),
                          variant: "primary",
                        },
                      ]}
                    />
                  </>
                ) : null}
              </PieceCard>
            );
          })}
        </div>
      )}

      <CycleFeedback locale={locale} clientId={client.id} />
    </>
  );
}
