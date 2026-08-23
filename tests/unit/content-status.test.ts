import { describe, it, expect } from "vitest";

import {
  EDITABLE_CONTENT_STATUSES,
  isEditableContentStatus,
  statusOptionsFor,
} from "@/lib/content-status";
import { SOCIAL_STAGES } from "@/lib/social";

/**
 * The draft editor used to render the whole `content_status` enum, so a piece
 * could be moved to `published` by picking it from a dropdown — skipping
 * direction approval, the client's approval, and the `published_posts` row the
 * report measures by. These tests pin the boundary between the two workflows.
 */

describe("which stages the content editor may set", () => {
  it("keeps the client's stages out of the editor entirely", () => {
    for (const stage of ["client_review", "changes_requested", "rejected"]) {
      expect(isEditableContentStatus(stage)).toBe(false);
    }
  });

  it("will not hand-set anything that means a piece is live or queued", () => {
    // These belong to scheduleDraftAction and the publish cron, which write a
    // scheduled_posts / published_posts row alongside. Setting the status by
    // hand would claim the piece is live with nothing to measure it by.
    expect(isEditableContentStatus("scheduled")).toBe(false);
    expect(isEditableContentStatus("published")).toBe(false);
  });

  it("leaves the backlog to the social module", () => {
    expect(isEditableContentStatus("backlog")).toBe(false);
  });

  it("still covers the engine's own lifecycle", () => {
    expect(isEditableContentStatus("draft")).toBe(true);
    expect(isEditableContentStatus("text_review")).toBe(true);
    expect(isEditableContentStatus("creative_review")).toBe(true);
    expect(isEditableContentStatus("approved")).toBe(true);
    expect(isEditableContentStatus("archived")).toBe(true);
  });

  it("refuses a value that is not a status at all", () => {
    expect(isEditableContentStatus("owner")).toBe(false);
    expect(isEditableContentStatus("")).toBe(false);
  });

  it("is a strict subset of the stages the module knows", () => {
    const known = new Set<string>([...SOCIAL_STAGES, "archived"]);
    for (const s of EDITABLE_CONTENT_STATUSES) expect(known.has(s)).toBe(true);
    expect(EDITABLE_CONTENT_STATUSES.length).toBeLessThan(known.size);
  });
});

describe("what the editor offers for a piece already in flight", () => {
  it("offers exactly the editable set for a piece the engine owns", () => {
    expect(statusOptionsFor("draft")).toEqual(EDITABLE_CONTENT_STATUSES);
  });

  it("offers a social-only stage back, so the select is not a lie", () => {
    // A piece parked at client_review must still render its own value, or the
    // dropdown would silently show something the piece is not.
    const options = statusOptionsFor("client_review");
    expect(options[0]).toBe("client_review");
    expect(options).toHaveLength(EDITABLE_CONTENT_STATUSES.length + 1);
  });

  it("does not let that stage become a way INTO the social pipeline", () => {
    // Offering it back is a no-op affordance: it is still not editable, so the
    // action refuses it for any piece not already there.
    expect(isEditableContentStatus("client_review")).toBe(false);
  });
});
