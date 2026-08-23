/**
 * Social media module · the client's daily digest.
 *
 * The module's rule is one message a day, never a ping per piece. A client who
 * gets four notifications on a Tuesday stops reading them, and the one that
 * mattered — a reply date about to pass — is the one they miss.
 *
 * Pure, like the rest of the module's rules. The cron route reads the database
 * and formats the text; this decides what belongs in a digest and whether there
 * is anything worth sending at all.
 */

import { isReplyOverdue, replyDueBy } from "@/lib/social";

export interface DigestPiece {
  id: string;
  title: string;
  publish_on: string | null;
  /** When it reached the client. Null means it has not, so it is not theirs yet. */
  sent_to_client_at: string | null;
}

export interface Digest {
  /** Reached the client since the last digest — the new arrivals. */
  arrived: DigestPiece[];
  /** Reply due today: the last day their answer changes anything. */
  dueToday: DigestPiece[];
  /** Reply date already passed; these run as scheduled unless they write. */
  overdue: DigestPiece[];
  /** Nothing to say — send nothing rather than a message that says "nothing". */
  empty: boolean;
}

/**
 * Build one client's digest.
 *
 * `since` is when that client was last written to, so a missed cron run does
 * not silently swallow a day's arrivals — the next run picks them up. A piece
 * can appear in more than one bucket only if it arrived and is already due,
 * which is worth saying twice.
 */
export function buildDigest(
  pieces: DigestPiece[],
  today: string,
  since: string | null,
): Digest {
  const awaiting = pieces.filter((p) => !!p.sent_to_client_at);

  const arrived = since
    ? awaiting.filter((p) => p.sent_to_client_at! > since)
    : awaiting;

  const dueToday = awaiting.filter((p) => replyDueBy(p.publish_on) === today);

  const overdue = awaiting.filter((p) => isReplyOverdue(p.publish_on, today));

  return {
    arrived,
    dueToday,
    overdue,
    empty: !arrived.length && !dueToday.length && !overdue.length,
  };
}

/**
 * The digest's one-line body. Kept here so the sentence is testable and the
 * cron stays about I/O — `t` is the caller's translator, bound to the client's
 * own locale.
 */
export function digestBody(
  digest: Digest,
  t: (key: string, values?: Record<string, number>) => string,
): string {
  // Singular and plural are separate keys, chosen here, because the digest's
  // translator is a plain {name} interpolator — it does not parse ICU, so an
  // ICU plural written in the dictionary would reach the client as literal
  // syntax. And n === 1 is the COMMON case in a piece-by-piece pipeline: the
  // strings used to read "1 vencem hoje", which is broken Portuguese in the
  // one message a client receives every working day.
  const pick = (base: string, n: number) => `${base}${n === 1 ? "One" : "Other"}`;

  const parts: string[] = [];
  for (const [base, list] of [
    ["arrived", digest.arrived],
    ["dueToday", digest.dueToday],
    ["overdue", digest.overdue],
  ] as const) {
    if (list.length) parts.push(t(pick(base, list.length), { n: list.length }));
  }
  return parts.join(" · ");
}
