"use client";

import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";

import { Pill } from "@/components/ui/Pill";
import { movesFor, type MoveSet, type SocialPiece } from "@/lib/social";
import { runTransitionAction, type Result } from "../actions";
import { Btn, Refusal } from "./ActionPrimitives";

const initial: Result = { ok: false };

type PieceForMoves = Pick<
  SocialPiece,
  "id" | "status" | "design_state" | "caption" | "material_url" | "publish_on"
> & { client_comment?: string | null };

/**
 * Every move a reader can make on a piece, rendered from the domain's answer
 * rather than from a hand-written branch per screen. `movesFor` decides; this
 * only draws.
 *
 * The comment box is shared across the buttons on purpose: "approve with
 * changes" and "not approved" both need a reason, and asking for it in the same
 * place the decision is made is what keeps one round-trip from becoming three.
 */
export function Moves({
  piece,
  caps,
  today,
  locale,
  clientName,
  since,
  extra,
}: {
  piece: PieceForMoves;
  caps: Parameters<typeof movesFor>[1];
  today: string;
  locale: string;
  /** For the one label that names the recipient. */
  clientName?: string;
  /** How long it has been sitting where it is — shown next to the wait pill. */
  since?: string | null;
  /** Extra fields the action needs, e.g. a publish date when pulling a theme. */
  extra?: React.ReactNode;
}) {
  const t = useTranslations("social");
  const [state, action, pending] = useActionState(runTransitionAction, initial);
  // One of these renders per piece on a page that maps over many, so a static
  // id would bind every label to the first textarea.
  const commentId = useId();

  // No refresh: runTransitionAction calls revalidateModule, so the action's
  // own response already carries the re-rendered route. Fetching it again cost
  // a second auth hop, a second layout render and a second listPieces() over
  // the whole tenant — on every stage move, the thing people click most.

  const set: MoveSet = movesFor(piece, caps, today);

  if (!set.moves.length) {
    if (!set.waitingOn) return null;
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Pill
          tone={set.waitingOn === "order" ? "success" : "brand"}
          className="text-[10px]"
        >
          {t(`waitingOn.${set.waitingOn}`)}
        </Pill>
        {since ? (
          <span className="text-xs text-muted-foreground">
            {t("waitingSince", { date: since })}
          </span>
        ) : null}
      </span>
    );
  }

  // The comment belongs to whichever move needs one; when several do they share
  // the box, and the strings come from the most explaining of them.
  const asking = set.moves.find((m) => m.needsComment);

  return (
    <form action={action} data-testid="piece-moves">
      <input type="hidden" name="id" value={piece.id} />
      <input type="hidden" name="locale" value={locale} />
      {extra}

      {asking ? (
        <div className="mb-3">
          <label
            htmlFor={commentId}
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {t(`actions.comment.${asking.action}.label`)}
          </label>
          <textarea
            id={commentId}
            name="comment"
            // A piece coming back from the client arrives with their words in
            // it; losing them to an empty box is how a reason becomes "rejected".
            defaultValue={
              asking.action === "return_to_backlog"
                ? (piece.client_comment ?? "")
                : ""
            }
            className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t(`actions.comment.${asking.action}.hint`)}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {set.moves.map((m) => (
          <Btn
            key={m.action}
            name="action"
            value={m.action}
            variant={m.tone}
            disabled={pending}
          >
            {m.action === "send_to_client"
              ? t("actions.send_to_client", { name: clientName ?? "" })
              : t(`actions.${m.action}`)}
          </Btn>
        ))}
      </div>
      <Refusal error={state.error} />
    </form>
  );
}
