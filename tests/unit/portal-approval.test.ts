import { describe, expect, it } from "vitest";

import {
  canRespond,
  isPortalDecision,
  type AnswerableDraft,
} from "@/lib/portal-approval";

const CLIENT = "client-1";

const draft = (over: Partial<AnswerableDraft> = {}): AnswerableDraft => ({
  engine: "content",
  status: "client_review",
  client_id: CLIENT,
  ...over,
});

const base = {
  decision: "approve",
  comment: "",
  preview: false,
  draft: draft(),
  clientId: CLIENT as string | null,
  answered: false,
};

describe("canRespond", () => {
  it("lets a linked client approve a draft that is with them", () => {
    expect(canRespond(base)).toEqual({
      ok: true,
      decision: "approve",
      comment: null,
    });
  });

  it("carries the comment through, trimmed", () => {
    const v = canRespond({
      ...base,
      decision: "request_changes",
      comment: "  shorter caption please  ",
    });
    expect(v).toEqual({
      ok: true,
      decision: "request_changes",
      comment: "shorter caption please",
    });
  });

  it("refuses changes asked for without a reason", () => {
    // A designer receiving "changes requested" and nothing else has nothing
    // to act on.
    expect(canRespond({ ...base, decision: "request_changes" })).toEqual({
      ok: false,
      reason: "needsComment",
    });
    expect(
      canRespond({ ...base, decision: "request_changes", comment: "   " }),
    ).toEqual({ ok: false, reason: "needsComment" });
  });

  it("never records a decision while previewing as a client", () => {
    // The founder can look; she cannot answer on the client's behalf.
    expect(canRespond({ ...base, preview: true })).toEqual({
      ok: false,
      reason: "preview",
    });
  });

  it("checks preview before it checks the draft", () => {
    // Otherwise a preview against someone else's draft reports "notFound",
    // which reads as "that draft is gone" rather than "you are previewing".
    expect(
      canRespond({ ...base, preview: true, draft: draft({ client_id: "other" }) }),
    ).toEqual({ ok: false, reason: "preview" });
  });

  it("refuses another client's draft the same way it refuses a missing one", () => {
    // Same reason for both: a different answer would confirm which draft ids
    // exist to someone who cannot see them.
    const missing = canRespond({ ...base, draft: null });
    const someoneElses = canRespond({
      ...base,
      draft: draft({ client_id: "other" }),
    });
    expect(missing).toEqual({ ok: false, reason: "notFound" });
    expect(someoneElses).toEqual(missing);
  });

  it("refuses a social piece — those move through the module, not this table", () => {
    expect(canRespond({ ...base, draft: draft({ engine: "social" }) })).toEqual({
      ok: false,
      reason: "wrongEngine",
    });
  });

  it("refuses a draft that is not with the client", () => {
    for (const status of ["draft", "creative_review", "approved", "published"]) {
      expect(canRespond({ ...base, draft: draft({ status }) })).toEqual({
        ok: false,
        reason: "notWithClient",
      });
    }
  });

  it("refuses a second answer", () => {
    expect(canRespond({ ...base, answered: true })).toEqual({
      ok: false,
      reason: "alreadyAnswered",
    });
  });

  it("refuses an unlinked login before it looks at anything else", () => {
    expect(canRespond({ ...base, clientId: null, draft: null })).toEqual({
      ok: false,
      reason: "notLinked",
    });
  });

  it("refuses a decision it does not know", () => {
    expect(canRespond({ ...base, decision: "delete" })).toEqual({
      ok: false,
      reason: "notFound",
    });
  });
});

describe("isPortalDecision", () => {
  it("accepts the two the portal offers and nothing else", () => {
    expect(isPortalDecision("approve")).toBe(true);
    expect(isPortalDecision("request_changes")).toBe(true);
    expect(isPortalDecision("client_reject")).toBe(false);
    expect(isPortalDecision("")).toBe(false);
  });
});
