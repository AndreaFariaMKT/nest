import { Constants } from "@/types/database.gen";

type ContentStatus = (typeof Constants.public.Enums.content_status)[number];

/**
 * The stages the content engine's draft editor may set by hand.
 *
 * `content_drafts.status` carries two workflows. The engine owns writing and
 * internal review; the social module owns everything from the client's desk
 * onward, and reaches those stages only through `runTransitionAction`, which
 * checks the capability, the current stage, and the piece's own readiness.
 *
 * The editor used to render `Constants.public.Enums.content_status` whole — all
 * eleven values — so picking "Published" from a dropdown moved a piece live
 * without direction approval, client approval, or a `published_posts` row to
 * measure it by. `scheduled` and `published` are likewise not hand-set: they
 * belong to `scheduleDraftAction` and the publish cron.
 */
export const EDITABLE_CONTENT_STATUSES = [
  "draft",
  "text_review",
  "creative_review",
  "approved",
  "archived",
] as const satisfies readonly ContentStatus[];

export type EditableContentStatus =
  (typeof EDITABLE_CONTENT_STATUSES)[number];

export function isEditableContentStatus(
  v: string,
): v is EditableContentStatus {
  return (EDITABLE_CONTENT_STATUSES as readonly string[]).includes(v);
}

/**
 * What the editor may offer for a piece currently in `current`.
 *
 * A piece parked in a social-only stage still has to render its own value or
 * the select would silently show something the piece is not — so the current
 * stage is offered back, and only as a no-op. Moving OUT of it is the social
 * module's call, not a dropdown's.
 */
export function statusOptionsFor(
  current: string,
): readonly ContentStatus[] {
  if (isEditableContentStatus(current)) return EDITABLE_CONTENT_STATUSES;
  return [current as ContentStatus, ...EDITABLE_CONTENT_STATUSES];
}
