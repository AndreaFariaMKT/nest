import { setRequestLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/ui/PageHeader";
import {
  dayOf,
  formatIsoDate,
  IN_FLIGHT_STAGES,
  type SocialStage,
} from "@/lib/social";
import { loadScope } from "../_data";
import { ModuleShell } from "../_components/ModuleShell";
import { PieceCard } from "../_components/PieceCard";
import { ReleaseAllButton } from "../_components/PieceActions";
import { Moves } from "../_components/Moves";
import { EmptyState } from "../_components/Shared";

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
              confirmLabel={t("fortnight.releaseAllConfirm", {
                n: signedOff.length,
              })}
            />
          </div>
        ) : null}
      </div>

      {pieces.length === 0 ? (
        <EmptyState>
          {t("fortnight.empty")}
        </EmptyState>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pieces.map((p) => (
            <PieceCard
              key={p.id}
              piece={p}
              clientName={scope.clientName(p.client_id)}
              today={scope.today}
              href={`/social/pieces/${p.id}`}
            >
              <Moves
                piece={p}
                caps={scope.caps}
                today={scope.today}
                locale={locale}
                clientName={scope.clientName(p.client_id).split(" ")[0]}
                since={
                  p.status === "text_review"
                    ? formatIsoDate(dayOf(p.sent_up_at), locale)
                    : null
                }
              />
            </PieceCard>
          ))}
        </div>
      )}
    </>
  );
}
