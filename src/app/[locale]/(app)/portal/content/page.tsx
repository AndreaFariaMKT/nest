import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/client-portal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import {
  CLIENT_VISIBLE_STAGES,
  STUDIO_TIMEZONE,
  isReplyOverdue,
  todayIso,
} from "@/lib/social";
import { PORTAL_PIECE_COLUMNS, type SocialPieceRow } from "../../social/_data";
import { PieceCard } from "../../social/_components/PieceCard";
import { Moves } from "../../social/_components/Moves";
import { CycleFeedback } from "./CycleFeedback";
import { EngineDraftCard, type EngineDraft } from "./EngineDraftCard";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotLinked } from "../_NotLinked";
import { EmptyState, ModuleNote } from "../../social/_components/Shared";

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
    .select(PORTAL_PIECE_COLUMNS)
    .eq("engine", "social")
    .eq("client_id", client.id)
    .in("status", CLIENT_VISIBLE_STAGES)
    .order("publish_on", { ascending: true, nullsFirst: false })
    .limit(OPTION_LIST_CAP);

  const pieces = (data ?? []) as unknown as SocialPieceRow[];

  // The content engine's half of this screen. Until now the portal filtered
  // `engine = 'social'` and stopped there, so a carousel built from the
  // client's own meeting never appeared here at all — their only way to answer
  // one was the /a/<token> link in their inbox, which expires in 14 days and
  // works exactly once. Signed in, with the piece in front of them, they had
  // everything except the button.
  const { data: engineData } = await supabase
    .from("content_drafts")
    .select("id, title")
    .eq("engine", "content")
    .eq("client_id", client.id)
    .eq("status", "client_review")
    .order("updated_at", { ascending: false })
    .limit(OPTION_LIST_CAP);

  const engineRows = (engineData ?? []) as Array<{ id: string; title: string }>;

  // `approvals` carries an owner-only policy, so the client cannot read their
  // own answers back. Read with the service role — but only for the ids the
  // query above already returned, which RLS has just proven belong to this
  // client. The widened credential never widens the set of rows.
  let answers = new Map<
    string,
    { approved: boolean; comment: string | null; at: string }
  >();
  if (engineRows.length) {
    const { data: approvalRows } = await createAdminClient()
      .from("approvals")
      .select("draft_id, approved_at, rejected_at, client_comment")
      .in(
        "draft_id",
        engineRows.map((d) => d.id),
      )
      .or("approved_at.not.is.null,rejected_at.not.is.null");
    answers = new Map(
      ((approvalRows ?? []) as Array<{
        draft_id: string;
        approved_at: string | null;
        rejected_at: string | null;
        client_comment: string | null;
      }>).map((a) => [
        a.draft_id,
        {
          approved: !!a.approved_at,
          comment: a.client_comment,
          at: (a.approved_at ?? a.rejected_at) as string,
        },
      ]),
    );
  }

  const answeredDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone: STUDIO_TIMEZONE,
  });

  const engineDrafts: EngineDraft[] = engineRows.map((d) => ({
    id: d.id,
    title: d.title,
    answered: answers.get(d.id) ?? null,
  }));
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

      <ModuleNote>
        {ts("portal.howItWorks")}
      </ModuleNote>

      {pieces.length === 0 ? (
        <EmptyState>
          {t("content.empty")}
        </EmptyState>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pieces.map((p) => {
            const decidable =
              p.status === "client_review" || p.status === "changes_requested";
            return (
              <PieceCard
                key={p.id}
                piece={p}
                clientName={client.name}
                today={today}
                showFull
                href={`/portal/content#${p.id}`}
              >
                {decidable ? (
                  <>
                    {/* Only the overdue branch. The card's own pill already
                        says "responder até <data>", formatted — this line
                        repeated it in raw ISO, so the client read the same
                        deadline twice, three lines apart, in two shapes.
                        What the pill does NOT carry is the consequence, and
                        that is what pastDue adds. */}
                    {isReplyOverdue(p.publish_on, today) ? (
                      <p className="mb-3 text-xs text-destructive">
                        {ts("portal.pastDue")}
                      </p>
                    ) : null}
                    <Moves
                      piece={p}
                      caps={["client"]}
                      today={today}
                      locale={locale}
                    />
                  </>
                ) : null}
              </PieceCard>
            );
          })}
        </div>
      )}

      {engineDrafts.length ? (
        <section className="mt-10">
          <h2 className="font-display text-xl leading-snug">
            {t("engineContent.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("engineContent.note")}
          </p>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {engineDrafts.map((d) => (
              <EngineDraftCard
                key={d.id}
                draft={d}
                locale={locale}
                dateLabel={
                  d.answered ? answeredDate.format(new Date(d.answered.at)) : undefined
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      <CycleFeedback locale={locale} clientId={client.id} />
    </>
  );
}
