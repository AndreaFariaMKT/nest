import { describe, expect, it } from "vitest";

import {
  BOARD_BUCKETS,
  bucketOf,
  canMoveToBucket,
  dropTargets,
  isBucketKey,
} from "@/lib/content-board";

describe("bucketOf", () => {
  it("places every status the board claims to show", () => {
    for (const b of BOARD_BUCKETS) {
      for (const s of b.statuses) expect(bucketOf(s)).toBe(b.key);
    }
  });
  it("returns null for a status the board does not show", () => {
    expect(bucketOf("archived")).toBeNull();
    expect(bucketOf("backlog")).toBeNull();
  });
});

describe("canMoveToBucket", () => {
  it("moves a draft forward to review and to approved", () => {
    expect(canMoveToBucket("draft", "review")).toEqual({
      ok: true,
      status: "client_review",
    });
    expect(canMoveToBucket("client_review", "approved")).toEqual({
      ok: true,
      status: "approved",
    });
  });

  it("moves backwards too — rework happens", () => {
    expect(canMoveToBucket("client_review", "drafting")).toEqual({
      ok: true,
      status: "draft",
    });
  });

  it("never lets anything be dragged into published", () => {
    // The publish cron writes that status when a post actually goes live.
    // A card dropped there would claim something is on Instagram that is not,
    // and the monthly report counts published posts.
    for (const s of ["draft", "client_review", "approved"]) {
      expect(canMoveToBucket(s, "published"), s).toEqual({
        ok: false,
        reason: "cronOwnsPublished",
      });
    }
  });

  it("will not drag a live post anywhere", () => {
    for (const b of ["drafting", "review", "approved"]) {
      expect(canMoveToBucket("published", b), b).toEqual({
        ok: false,
        reason: "alreadyLive",
      });
    }
  });

  it("will not reopen a scheduled draft behind the queue's back", () => {
    // `scheduled` means a scheduled_posts row is holding a date. Moving the
    // draft back would leave the cron pointing at something reopened, and it
    // would publish it anyway.
    expect(canMoveToBucket("scheduled", "drafting")).toEqual({
      ok: false,
      reason: "unscheduleFirst",
    });
  });

  it("says 'already live' before it complains about the destination", () => {
    expect(canMoveToBucket("published", "published")).toEqual({
      ok: false,
      reason: "sameBucket",
    });
    expect(canMoveToBucket("published", "nowhere")).toEqual({
      ok: false,
      reason: "unknownBucket",
    });
  });

  it("refuses a drop onto the column it came from", () => {
    expect(canMoveToBucket("draft", "drafting")).toEqual({
      ok: false,
      reason: "sameBucket",
    });
  });

  it("refuses a status the board does not show", () => {
    expect(canMoveToBucket("archived", "review")).toEqual({
      ok: false,
      reason: "notOnBoard",
    });
  });
});

describe("dropTargets", () => {
  it("offers only columns the move would accept", () => {
    // The board renders drop zones from this, so anything listed has to run.
    for (const b of BOARD_BUCKETS) {
      for (const s of b.statuses) {
        for (const target of dropTargets(s)) {
          expect(canMoveToBucket(s, target).ok, `${s} → ${target}`).toBe(true);
        }
      }
    }
  });

  it("offers nothing for a published or scheduled card", () => {
    expect(dropTargets("published")).toEqual([]);
    expect(dropTargets("scheduled")).toEqual([]);
  });

  it("never offers published", () => {
    for (const b of BOARD_BUCKETS) {
      for (const s of b.statuses) expect(dropTargets(s)).not.toContain("published");
    }
  });
});

describe("isBucketKey", () => {
  it("accepts the four the board has", () => {
    expect(BOARD_BUCKETS.map((b) => b.key).every(isBucketKey)).toBe(true);
    expect(isBucketKey("archived")).toBe(false);
  });
});
