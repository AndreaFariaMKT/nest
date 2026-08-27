/**
 * The content calendar's buckets, and what may be dragged where.
 *
 * The board groups several statuses into one column, so a drop needs a
 * canonical destination — and, more importantly, rules. Two of them are not
 * cosmetic:
 *
 * - `published` is not a drop target. That status is written by the publish
 *   cron when a post actually goes live (`api/cron/publish`). A card dragged
 *   into it would claim something is on Instagram that is not, and the report
 *   counts published posts.
 * - A scheduled draft cannot be dragged backwards. `scheduled` means a
 *   `scheduled_posts` row is holding a date for it; moving the draft back
 *   would leave the queue pointing at something the studio has reopened, and
 *   the cron would publish it anyway.
 *
 * The board renders its drop targets from `dropTargets`, so a column that
 * refuses a card cannot be offered as somewhere to drop it.
 */

export const BOARD_BUCKETS = [
  { key: "drafting", statuses: ["draft", "text_review", "creative_review"] },
  { key: "review", statuses: ["client_review"] },
  { key: "approved", statuses: ["approved", "scheduled"] },
  { key: "published", statuses: ["published"] },
] as const;

export type BucketKey = (typeof BOARD_BUCKETS)[number]["key"];

export function isBucketKey(v: string): v is BucketKey {
  return BOARD_BUCKETS.some((b) => b.key === v);
}

/** Which column a draft sits in. Null for anything the board does not show. */
export function bucketOf(status: string): BucketKey | null {
  const found = BOARD_BUCKETS.find((b) =>
    (b.statuses as readonly string[]).includes(status),
  );
  return found ? found.key : null;
}

/**
 * The status a drop into this column should write. `published` has none on
 * purpose — see above.
 */
const DESTINATION: Record<BucketKey, string | null> = {
  drafting: "draft",
  review: "client_review",
  approved: "approved",
  published: null,
};

export const BOARD_REFUSALS = [
  "unknownBucket",
  "notOnBoard",
  "sameBucket",
  "cronOwnsPublished",
  "alreadyLive",
  "unscheduleFirst",
] as const;
export type BoardRefusal = (typeof BOARD_REFUSALS)[number];

export type BoardVerdict =
  | { ok: true; status: string }
  | { ok: false; reason: BoardRefusal };

export function canMoveToBucket(
  status: string,
  bucket: string,
): BoardVerdict {
  if (!isBucketKey(bucket)) return { ok: false, reason: "unknownBucket" };

  const from = bucketOf(status);
  if (!from) return { ok: false, reason: "notOnBoard" };
  if (from === bucket) return { ok: false, reason: "sameBucket" };

  // Checked before the destination, so dragging a live post anywhere says
  // "it is already live" rather than complaining about where it landed.
  if (status === "published") return { ok: false, reason: "alreadyLive" };
  if (status === "scheduled") return { ok: false, reason: "unscheduleFirst" };

  const to = DESTINATION[bucket];
  if (!to) return { ok: false, reason: "cronOwnsPublished" };

  return { ok: true, status: to };
}

/** The columns this card may actually be dropped into. */
export function dropTargets(status: string): BucketKey[] {
  return BOARD_BUCKETS.map((b) => b.key).filter(
    (k) => canMoveToBucket(status, k).ok,
  );
}
