import { describe, it, expect } from "vitest";

// month.ts, not the components: vitest cannot parse TSX, which is the same
// reason the role vocabulary had to leave roles.ts.
import {
  CHIP,
  shiftMonth,
  monthFromParam,
} from "@/components/calendar/month";
import { SOCIAL_STAGES, STAGE_TONE } from "@/lib/social";

/**
 * The chip table used to exist twice, hand-mirrored from STAGE_TONE in the
 * studio's calendar and the client's. The test that guards STAGE_TONE's keys
 * reached neither copy, so adding a stage broke both calendars at render —
 * silently, on the two screens a client actually looks at.
 */
describe("calendar chips", () => {
  it("has a colour for every tone a stage can carry", () => {
    for (const stage of SOCIAL_STAGES) {
      const tone = STAGE_TONE[stage];
      expect(CHIP[tone], `${stage} → ${tone}`).toBeTruthy();
    }
  });
});

describe("month arithmetic", () => {
  it("steps back over a year boundary", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("steps within a year", () => {
    expect(shiftMonth("2026-08", 1)).toBe("2026-09");
    expect(shiftMonth("2026-08", -1)).toBe("2026-07");
  });

  it("falls back to today's month on a malformed param", () => {
    // The month reaches these pages from the query string, so it is whatever
    // someone typed. A bad value used to be read straight into Date.UTC.
    expect(monthFromParam("2026-08", "2026-08-24")).toBe("2026-08");
    expect(monthFromParam("nonsense", "2026-08-24")).toBe("2026-08");
    expect(monthFromParam(undefined, "2026-08-24")).toBe("2026-08");
    expect(monthFromParam(["2026-03"], "2026-08-24")).toBe("2026-03");
  });
});
