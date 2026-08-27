"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { movesForProspect, type PipelineMove } from "@/lib/pipeline";
import { movePipelineAction, type PipelineState } from "./actions";

const initial: PipelineState = { ok: false };

export type Prospect = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  status: string;
  pipeline_stage: string | null;
};

/**
 * One prospect, and what can happen to it next.
 *
 * The buttons come from `movesForProspect`, not from a branch written here —
 * the same arrangement the social module uses, and the reason a test can
 * assert the board never offers a move the write would refuse.
 *
 * "Mark lost" opens the reason box instead of submitting, because a loss
 * without a reason is the one write the domain refuses, and finding that out
 * after clicking is worse than being asked first.
 */
export function ProspectCard({
  prospect,
  locale,
}: {
  prospect: Prospect;
  locale: string;
}) {
  const t = useTranslations("commercial.pipeline");
  const [state, action, pending] = useActionState(movePipelineAction, initial);
  const [losing, setLosing] = useState(false);

  const moves = movesForProspect(prospect);
  const label = (m: PipelineMove) => t(`move.${m}`);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <Link
        href={`/clients/${prospect.slug}`}
        className="block truncate text-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {prospect.name}
      </Link>
      {prospect.industry ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {prospect.industry}
        </p>
      ) : null}

      <form action={action} className="mt-3 space-y-2">
        <input type="hidden" name="id" value={prospect.id} />
        <input type="hidden" name="locale" value={locale} />

        {losing ? (
          <div>
            <Label htmlFor={`reason-${prospect.id}`} className="text-xs">
              {t("reasonLabel")}
            </Label>
            <Textarea
              id={`reason-${prospect.id}`}
              name="reason"
              rows={2}
              required
              autoFocus
              className="mt-1 text-sm"
              placeholder={t("reasonPlaceholder")}
              maxLength={500}
            />
          </div>
        ) : null}

        {!state.ok && state.error ? (
          <p role="alert" className="text-xs text-destructive">
            {t(`refusal.${state.error}`)}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {moves.map((m) =>
            m === "lose" && !losing ? (
              <Button
                key={m}
                type="button"
                variant="danger"
                className="h-8 px-2 text-xs"
                onClick={() => setLosing(true)}
              >
                {label(m)}
              </Button>
            ) : (
              <Button
                key={m}
                type="submit"
                name="move"
                value={m}
                disabled={pending}
                variant={
                  m === "convert" ? "brand" : m === "lose" ? "danger" : "secondary"
                }
                className="h-8 px-2 text-xs"
              >
                {label(m)}
              </Button>
            ),
          )}
        </div>
      </form>
    </div>
  );
}
