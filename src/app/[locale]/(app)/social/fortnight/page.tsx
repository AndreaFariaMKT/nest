import { setRequestLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { IN_FLIGHT_STAGES, isReplyOverdue, type SocialStage } from "@/lib/social";
import { loadScope } from "../_data";
import { ModuleShell } from "../_components/ModuleShell";
import { PieceCard } from "../_components/PieceCard";
import {
  DecisionForm,
  QuickAction,
  ReleaseAllButton,
} from "../_components/PieceActions";

export const dynamic = "force-dynamic";

/** The five points a piece passes through inside one fortnight. */
const FLOW: SocialStage[] = [
  "draft",
  "text_review",
  "creative_review",
  "client_review",
  "approved",
];

export default async function FortnightPage({
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

  const pieces = scope.pieces.filter((p) => IN_FLIGHT_STAGES.includes(p.status));
  const signedOff = pieces.filter(
    (p) => p.status === "creative_review" && p.design_state === "signed_off",
  );

  return (
    <>
      <PageHeader
        title={t("fortnight.title")}
        subtitle={t("fortnight.subtitle")}
      />
      <ModuleShell scope={scope} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FLOW.map((stage, i) => {
          const n = pieces.filter((p) => p.status === stage).length;
          return (
            <div key={stage} className="flex items-center gap-2">
              <div
                className={`min-w-[130px] rounded-xl border p-3 ${
                  n ? "border-brand bg-card" : "border-transparent bg-muted/50"
                }`}
              >
                <p
                  className={`font-display text-2xl leading-none ${
                    n ? "text-brand" : "text-muted-foreground"
                  }`}
                >
                  {n}
                </p>
                <p className="mt-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t(`stage.${stage}`)}
                </p>
              </div>
              {i < FLOW.length - 1 ? (
                <span className="text-muted-foreground/30">→</span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mb-4 rounded-xl border-l-2 border-brand bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        <p>{t("fortnight.note")}</p>
        {signedOff.length && scope.caps.includes("coordinate") ? (
          <div className="mt-3">
            <ReleaseAllButton
              locale={locale}
              clientId={scope.client?.id}
              label={t("fortnight.releaseAll", { n: signedOff.length })}
            />
          </div>
        ) : null}
      </div>

      {pieces.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
          {t("fortnight.empty")}
        </p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pieces.map((p) => (
            <PieceCard
              key={p.id}
              piece={p}
              clientName={name(p.client_id)}
              today={scope.today}
              href={`/social/pieces/${p.id}`}
            >
              <Actions
                stage={p.status}
                overdue={isReplyOverdue(p.publish_on, scope.today)}
                clientComment={p.client_comment ?? ""}
                designed={p.design_state === "signed_off"}
                hasText={!!p.caption?.trim()}
                id={p.id}
                locale={locale}
                caps={scope.caps}
                clientFirstName={name(p.client_id).split(" ")[0]}
                t={t}
              />
            </PieceCard>
          ))}
        </div>
      )}
    </>
  );
}

type Translate = Awaited<ReturnType<typeof getTranslations<"social">>>;

/** What this reader can actually do to this piece, right now. */
function Actions({
  stage,
  overdue,
  clientComment,
  designed,
  hasText,
  id,
  locale,
  caps,
  clientFirstName,
  t,
}: {
  stage: SocialStage;
  overdue: boolean;
  clientComment: string;
  designed: boolean;
  hasText: boolean;
  id: string;
  locale: string;
  caps: string[];
  clientFirstName: string;
  t: Translate;
}) {
  const coordinate = caps.includes("coordinate");
  const direction = caps.includes("direction");

  if (stage === "draft" && coordinate) {
    return hasText ? (
      <QuickAction
        id={id}
        locale={locale}
        action="send_text_up"
        label={t("actions.sendTextUp")}
        variant="primary"
      />
    ) : (
      <p className="text-xs text-muted-foreground">{t("fortnight.stillToWrite")}</p>
    );
  }

  if (stage === "text_review") {
    if (!direction) {
      return (
        <Pill tone="brand" className="text-[10px]">
          {t("fortnight.withDirection")}
        </Pill>
      );
    }
    return (
      <DecisionForm
        id={id}
        locale={locale}
        commentLabel={t("actions.directionNoteLabel")}
        commentHint={t("actions.directionNoteHint")}
        choices={[
          {
            action: "direction_reject",
            label: t("actions.sendBackToWriting"),
            variant: "danger",
          },
          {
            action: "direction_approve",
            label: t("actions.approveText"),
            variant: "primary",
          },
        ]}
      />
    );
  }

  if (stage === "creative_review" && coordinate) {
    return designed ? (
      <QuickAction
        id={id}
        locale={locale}
        action="send_to_client"
        label={t("actions.sendToClient", { name: clientFirstName })}
        variant="primary"
      />
    ) : (
      <Pill tone="warning" className="text-[10px]">
        {t("fortnight.inDesign")}
      </Pill>
    );
  }

  if (stage === "changes_requested" && coordinate) {
    return (
      <QuickAction
        id={id}
        locale={locale}
        action="reopen_to_design"
        label={t("actions.backToDesign")}
        variant="primary"
      />
    );
  }

  if (stage === "rejected" && (coordinate || direction)) {
    return (
      <DecisionForm
        id={id}
        locale={locale}
        commentLabel={t("actions.returnReasonLabel")}
        defaultComment={clientComment}
        choices={[
          {
            action: "return_to_backlog",
            label: t("actions.returnToBacklog"),
            variant: "primary",
          },
        ]}
      />
    );
  }

  if (stage === "approved") {
    return (
      <Pill tone="success" className="text-[10px]">
        {t("fortnight.waitingForOrder")}
      </Pill>
    );
  }

  if (stage === "client_review") {
    // Past the reply date the studio may move it on. Before that, the client's
    // window is theirs.
    return overdue && coordinate ? (
      <DecisionForm
        id={id}
        locale={locale}
        choices={[
          {
            action: "approve_on_silence",
            label: t("actions.approveOnSilence"),
            variant: "primary",
          },
        ]}
      />
    ) : (
      <Pill tone="brand" className="text-[10px]">
        {t("fortnight.withClient")}
      </Pill>
    );
  }

  return null;
}
