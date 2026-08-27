/**
 * Whether a signed-in client may answer a content-engine draft, and why not.
 *
 * The rules live here rather than inside the server action for the same reason
 * `canRun` does: the action is the one place they cannot be tested, and a rule
 * that is only exercised through a form is a rule that drifts.
 *
 * Scope is deliberately narrow. Social pieces do NOT come through here — they
 * move through the module's own stage machine, on the piece, and a client
 * answering one there moves the stage. `approvals` records the content
 * engine's answers only; a social approval landing in this table would be
 * recorded where no social screen reads it, which is the bug migration 026 and
 * `generateApprovalLinkAction` already had to fix once.
 */

export const PORTAL_DECISIONS = ["approve", "request_changes"] as const;
export type PortalDecision = (typeof PORTAL_DECISIONS)[number];

export const PORTAL_REFUSALS = [
  "notLinked",
  "preview",
  "notFound",
  "wrongEngine",
  "notWithClient",
  "alreadyAnswered",
  "needsComment",
] as const;
export type PortalRefusal = (typeof PORTAL_REFUSALS)[number];

export function isPortalDecision(v: string): v is PortalDecision {
  return (PORTAL_DECISIONS as readonly string[]).includes(v);
}

export type PortalVerdict =
  | { ok: true; decision: PortalDecision; comment: string | null }
  | { ok: false; reason: PortalRefusal };

/** The draft as this check needs to see it. */
export type AnswerableDraft = {
  engine: string;
  status: string;
  client_id: string | null;
};

export function canRespond(input: {
  decision: string;
  comment: string;
  /** A founder looking through "view as" — never records a client decision. */
  preview: boolean;
  /** Null when the draft is missing or not this client's. */
  draft: AnswerableDraft | null;
  /** Null when the login is not linked to a client. */
  clientId: string | null;
  /** An approvals row for this draft already carries an answer. */
  answered: boolean;
}): PortalVerdict {
  const { decision, preview, draft, clientId, answered } = input;
  const comment = input.comment.trim();

  if (!isPortalDecision(decision)) return { ok: false, reason: "notFound" };
  if (!clientId) return { ok: false, reason: "notLinked" };

  // Checked before anything about the draft. The portal preview exists so the
  // studio can see what a client sees; recording a decision *as* that client
  // would put words in their mouth, and the draft would move on the strength
  // of an answer they never gave.
  if (preview) return { ok: false, reason: "preview" };

  // One refusal for "missing" and "not yours" on purpose: telling an outsider
  // which draft ids exist is the leak `/api/reports` already avoids by
  // answering 404 rather than 403.
  if (!draft || draft.client_id !== clientId) {
    return { ok: false, reason: "notFound" };
  }
  if (draft.engine !== "content") return { ok: false, reason: "wrongEngine" };
  if (draft.status !== "client_review") {
    return { ok: false, reason: "notWithClient" };
  }
  if (answered) return { ok: false, reason: "alreadyAnswered" };

  // "Approve" stands on its own; asking for changes without saying which ones
  // sends the piece back to a designer with nothing to act on.
  if (decision === "request_changes" && !comment) {
    return { ok: false, reason: "needsComment" };
  }

  return { ok: true, decision, comment: comment || null };
}
