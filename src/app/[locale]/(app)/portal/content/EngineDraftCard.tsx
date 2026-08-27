"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Pill } from "@/components/ui/Pill";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PORTAL_REFUSALS } from "@/lib/portal-approval";
import { respondToDraftAction, type RespondState } from "./actions";

const initial: RespondState = { ok: false };

export type EngineDraft = {
  id: string;
  title: string;
  answered: null | { approved: boolean; comment: string | null; at: string };
};

/**
 * One content-engine draft, and the client's answer to it.
 *
 * Both buttons submit the same form so they share one comment box: "approve"
 * and "request changes" are two answers to one question, and splitting the
 * reason into two places is how one round-trip becomes three. The same
 * reasoning the social module's `Moves` already uses.
 *
 * Once answered the card keeps showing the answer rather than disappearing —
 * a piece that vanishes on click reads as a piece that was lost.
 */
export function EngineDraftCard({
  draft,
  locale,
  dateLabel,
}: {
  draft: EngineDraft;
  locale: string;
  /** Formatted server-side, so the two renders agree on the timezone. */
  dateLabel?: string;
}) {
  const t = useTranslations("portal.engineContent");
  const [state, action, pending] = useActionState(
    respondToDraftAction,
    initial,
  );

  const answered = draft.answered;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle>{draft.title}</CardTitle>
        {answered ? (
          <Pill tone={answered.approved ? "success" : "warning"}>
            {answered.approved ? t("approved") : t("changesRequested")}
          </Pill>
        ) : null}
      </CardHeader>

      <CardContent>
        {answered ? (
          <div className="space-y-1 text-sm">
            {dateLabel ? (
              <p className="text-muted-foreground">
                {t("answeredOn", { date: dateLabel })}
              </p>
            ) : null}
            {answered.comment ? (
              <p className="text-foreground">“{answered.comment}”</p>
            ) : null}
          </div>
        ) : (
          <form action={action} className="space-y-3">
            <input type="hidden" name="draftId" value={draft.id} />
            <input type="hidden" name="locale" value={locale} />

            <div>
              <Label htmlFor={`comment-${draft.id}`}>{t("commentLabel")}</Label>
              <Textarea
                id={`comment-${draft.id}`}
                name="comment"
                rows={3}
                className="mt-1"
                placeholder={t("commentPlaceholder")}
                maxLength={2000}
              />
            </div>

            {/* The refusal is rendered from the domain's own reason, so a new
                one cannot ship without a string — `PORTAL_REFUSALS` is asserted
                against both dictionaries in tests/unit/portal-i18n.test.ts. */}
            {!state.ok && state.error ? (
              <p role="alert" className="text-sm text-destructive">
                {(PORTAL_REFUSALS as readonly string[]).includes(state.error)
                  ? t(`refusal.${state.error}`)
                  : t(`refusal.${state.error === "rateLimited" ? "rateLimited" : "failed"}`)}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                name="decision"
                value="approve"
                variant="brand"
                disabled={pending}
              >
                {t("approve")}
              </Button>
              <Button
                type="submit"
                name="decision"
                value="request_changes"
                variant="danger"
                disabled={pending}
              >
                {t("requestChanges")}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
