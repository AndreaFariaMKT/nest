/**
 * Whether a queued post can be moved to another slot.
 *
 * `scheduled_posts.status` runs pending → publishing → published, with failed
 * off to the side. Only two of those are still the studio's to change:
 *
 * - `publishing` is in flight. The cron has picked it up and is talking to
 *   Meta; moving the date underneath it does not recall anything, it just
 *   makes the record disagree with what was sent.
 * - `published` is out. There is no rescheduling something people have
 *   already seen.
 * - `failed` can be moved, because a new date is exactly how a failed post is
 *   retried.
 *
 * The date rule is about the cron, not about taste. `api/cron/publish` runs
 * once a day and takes everything already due, so a slot in the past is not
 * "scheduled early" — it goes out on the next run, which is rarely what
 * someone dragging a card backwards meant.
 */

export const RESCHEDULABLE = ["pending", "failed"] as const;

export const SCHEDULE_REFUSALS = [
  "inFlight",
  "alreadyPublished",
  "unknownStatus",
  "badDate",
  "inThePast",
  "tooFar",
] as const;
export type ScheduleRefusal = (typeof SCHEDULE_REFUSALS)[number];

export type ScheduleVerdict =
  | { ok: true; iso: string }
  | { ok: false; reason: ScheduleRefusal };

/** A year out. Past this, a date is a typo — 2206 rather than 2026. */
const MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

export function canReschedule(input: {
  status: string;
  /** Already converted to an instant by the caller (studio clock). */
  iso: string | null;
  /** Now, injected so this is testable. */
  now: number;
}): ScheduleVerdict {
  const { status, iso, now } = input;

  if (status === "publishing") return { ok: false, reason: "inFlight" };
  if (status === "published") return { ok: false, reason: "alreadyPublished" };
  if (!(RESCHEDULABLE as readonly string[]).includes(status)) {
    return { ok: false, reason: "unknownStatus" };
  }

  if (!iso) return { ok: false, reason: "badDate" };
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return { ok: false, reason: "badDate" };

  if (at < now) return { ok: false, reason: "inThePast" };
  if (at - now > MAX_AHEAD_MS) return { ok: false, reason: "tooFar" };

  return { ok: true, iso: new Date(at).toISOString() };
}

/** Can this row be moved at all — drives whether the control is offered. */
export function isReschedulable(status: string): boolean {
  return (RESCHEDULABLE as readonly string[]).includes(status);
}
