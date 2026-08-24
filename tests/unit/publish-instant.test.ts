import { describe, it, expect } from "vitest";

import { publishInstant } from "@/lib/social";

/**
 * A piece carries a calendar day and a wall-clock time; the publishing queue
 * stores an instant. This is the only place those two meet, and being three
 * hours out would publish a piece the evening before its date.
 */

describe("turning the studio's day and time into an instant", () => {
  it("reads the time as São Paulo, not as the server's timezone", () => {
    // 08:00 in São Paulo is 11:00 UTC.
    expect(publishInstant("2026-09-12", "08:00")).toBe(
      "2026-09-12T11:00:00.000Z",
    );
  });

  it("accepts the shape Postgres returns, not just the form's", () => {
    expect(publishInstant("2026-09-12", "08:00:00")).toBe(
      "2026-09-12T11:00:00.000Z",
    );
  });

  it("does not roll a late-evening slot into the next day", () => {
    // 22:00 in São Paulo is 01:00 UTC the FOLLOWING day — correct, and the
    // reason this cannot be done by pasting a "Z" on the end.
    expect(publishInstant("2026-09-12", "22:00")).toBe(
      "2026-09-13T01:00:00.000Z",
    );
  });

  it("refuses a piece with no date instead of inventing one", () => {
    expect(publishInstant(null, "08:00")).toBeNull();
    expect(publishInstant("", "08:00")).toBeNull();
  });

  it("refuses a date that is not a date", () => {
    expect(publishInstant("12/09/2026", "08:00")).toBeNull();
    expect(publishInstant("2026-9-12", "08:00")).toBeNull();
  });

  it("falls back to the module's default hour when time is missing", () => {
    // publish_time is NOT NULL with a default of 08:00, so this is a guard
    // rather than a live path — but a null must not produce Invalid Date.
    expect(publishInstant("2026-09-12", null)).toBe("2026-09-12T11:00:00.000Z");
  });

  it("refuses a time it cannot read", () => {
    expect(publishInstant("2026-09-12", "manhã")).toBeNull();
  });
});
