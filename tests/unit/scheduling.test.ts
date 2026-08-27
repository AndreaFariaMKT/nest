import { describe, expect, it } from "vitest";

import { canReschedule, isReschedulable } from "@/lib/scheduling";

const NOW = Date.parse("2026-08-27T12:00:00Z");
const inDays = (n: number) =>
  new Date(NOW + n * 24 * 60 * 60 * 1000).toISOString();

describe("canReschedule", () => {
  it("moves a pending post to a later slot", () => {
    const v = canReschedule({ status: "pending", iso: inDays(3), now: NOW });
    expect(v).toEqual({ ok: true, iso: inDays(3) });
  });

  it("lets a failed post be retried on a new date", () => {
    expect(
      canReschedule({ status: "failed", iso: inDays(1), now: NOW }).ok,
    ).toBe(true);
  });

  it("will not move a post that is being sent right now", () => {
    // The cron is already talking to Meta. Moving the date does not recall
    // anything; it only makes the record disagree with what was sent.
    expect(canReschedule({ status: "publishing", iso: inDays(3), now: NOW })).toEqual(
      { ok: false, reason: "inFlight" },
    );
  });

  it("will not move a post people have already seen", () => {
    expect(canReschedule({ status: "published", iso: inDays(3), now: NOW })).toEqual(
      { ok: false, reason: "alreadyPublished" },
    );
  });

  it("refuses a slot in the past", () => {
    // The publish cron takes everything already due, so a past slot is not
    // "earlier" — it goes out on the next run.
    expect(canReschedule({ status: "pending", iso: inDays(-1), now: NOW })).toEqual(
      { ok: false, reason: "inThePast" },
    );
  });

  it("refuses a date more than a year out", () => {
    expect(canReschedule({ status: "pending", iso: inDays(400), now: NOW })).toEqual(
      { ok: false, reason: "tooFar" },
    );
    expect(canReschedule({ status: "pending", iso: inDays(360), now: NOW }).ok).toBe(
      true,
    );
  });

  it("refuses a date it cannot read", () => {
    expect(canReschedule({ status: "pending", iso: null, now: NOW })).toEqual({
      ok: false,
      reason: "badDate",
    });
    expect(
      canReschedule({ status: "pending", iso: "not a date", now: NOW }),
    ).toEqual({ ok: false, reason: "badDate" });
  });

  it("refuses a status it does not know", () => {
    expect(canReschedule({ status: "queued", iso: inDays(1), now: NOW })).toEqual({
      ok: false,
      reason: "unknownStatus",
    });
  });

  it("checks the status before the date", () => {
    // A published post with a bad date should say it is published, not that
    // the date is unreadable.
    expect(canReschedule({ status: "published", iso: null, now: NOW })).toEqual({
      ok: false,
      reason: "alreadyPublished",
    });
  });
});

describe("isReschedulable", () => {
  it("agrees with canReschedule about which statuses can move", () => {
    for (const s of ["pending", "failed", "publishing", "published", "queued"]) {
      const offered = isReschedulable(s);
      const runs = canReschedule({ status: s, iso: inDays(1), now: NOW }).ok;
      expect(offered, s).toBe(runs);
    }
  });
});
