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
import { PORTAL_PIECE_COLUMNS, type SocialPieceRow } from "../../social/_data";
import { PieceCard } from "../../social/_components/PieceCard";
import { Moves } from "../../social/_components/Moves";
import { CycleFeedback } from "./CycleFeedback";
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
    .eq("client_id", client.id)
    .in("status", CLIENT_VISIBLE_STAGES)
    .order("publish_on", { ascending: true, nullsFirst: false });

  const pieces = (data ?? []) as unknown as SocialPieceRow[];
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

      <CycleFeedback locale={locale} clientId={client.id} />
    </>
  );
}
