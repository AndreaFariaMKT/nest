import { describe, expect, it } from "vitest";
import {
  buildEventResource,
  next30DaysWindow,
  parseEventResponse,
} from "@/lib/google-calendar";

describe("buildEventResource", () => {
  const meeting = {
    id: "00000000-0000-0000-0000-000000000abc",
    title: "Strategy review",
    starts_at: "2026-05-10T14:00:00.000Z",
    ends_at: "2026-05-10T15:00:00.000Z",
  };

  it("maps title to summary and ISO times to dateTime", () => {
    const resource = buildEventResource(meeting);
    expect(resource.summary).toBe("Strategy review");
    expect(resource.start.dateTime).toBe("2026-05-10T14:00:00.000Z");
    expect(resource.end.dateTime).toBe("2026-05-10T15:00:00.000Z");
  });

  it("synthesizes a 1h end when ends_at is null (Google rejects open-ended events)", () => {
    const resource = buildEventResource({ ...meeting, ends_at: null });
    expect(resource.end.dateTime).toBe("2026-05-10T15:00:00.000Z");
  });

  it("omits conferenceData unless withMeet is opted in", () => {
    expect(buildEventResource(meeting).conferenceData).toBeUndefined();
    expect(buildEventResource(meeting, { withMeet: false }).conferenceData).toBeUndefined();
  });

  it("emits a stable conferenceData.requestId so retries are idempotent", () => {
    const a = buildEventResource(meeting, { withMeet: true });
    const b = buildEventResource(meeting, { withMeet: true });
    expect(a.conferenceData?.createRequest.requestId).toBe(
      `nest-meeting-${meeting.id}`,
    );
    expect(a.conferenceData?.createRequest.requestId).toBe(
      b.conferenceData?.createRequest.requestId,
    );
    expect(a.conferenceData?.createRequest.conferenceSolutionKey.type).toBe(
      "hangoutsMeet",
    );
  });

  it("includes description only when present", () => {
    expect(buildEventResource({ ...meeting, description: null }).description).toBeUndefined();
    expect(buildEventResource({ ...meeting, description: "agenda" }).description).toBe(
      "agenda",
    );
  });
});

describe("parseEventResponse", () => {
  it("maps summary, dateTimes, and hangoutLink", () => {
    const parsed = parseEventResponse({
      id: "evt-1",
      summary: "Strategy review",
      start: { dateTime: "2026-05-10T14:00:00.000Z" },
      end: { dateTime: "2026-05-10T15:00:00.000Z" },
      hangoutLink: "https://meet.google.com/abc-defg-hij",
      htmlLink: "https://calendar.google.com/event?eid=xxx",
    });
    expect(parsed).toEqual({
      id: "evt-1",
      title: "Strategy review",
      startsAt: "2026-05-10T14:00:00.000Z",
      endsAt: "2026-05-10T15:00:00.000Z",
      meetUrl: "https://meet.google.com/abc-defg-hij",
      htmlLink: "https://calendar.google.com/event?eid=xxx",
    });
  });

  it("falls back to all-day `date` fields when dateTime missing", () => {
    const parsed = parseEventResponse({
      id: "evt-2",
      summary: "All-day",
      start: { date: "2026-05-10" },
      end: { date: "2026-05-11" },
    });
    expect(parsed.startsAt).toBe(new Date("2026-05-10").toISOString());
    expect(parsed.endsAt).toBe(new Date("2026-05-11").toISOString());
  });

  it("falls back to conferenceData.entryPoints when hangoutLink absent", () => {
    const parsed = parseEventResponse({
      id: "evt-3",
      conferenceData: {
        entryPoints: [
          { entryPointType: "phone", uri: "tel:+11234" },
          { entryPointType: "video", uri: "https://meet.google.com/xyz-uvw-rst" },
        ],
      },
    });
    expect(parsed.meetUrl).toBe("https://meet.google.com/xyz-uvw-rst");
  });

  it("returns null meetUrl when no video entry point and no hangoutLink", () => {
    const parsed = parseEventResponse({
      id: "evt-4",
      conferenceData: { entryPoints: [{ entryPointType: "phone", uri: "tel:+1" }] },
    });
    expect(parsed.meetUrl).toBeNull();
  });

  it("normalises missing summary to empty string", () => {
    const parsed = parseEventResponse({ id: "evt-5" });
    expect(parsed.title).toBe("");
    expect(parsed.startsAt).toBeNull();
    expect(parsed.endsAt).toBeNull();
  });
});

describe("next30DaysWindow", () => {
  it("returns the [now, now+30d] window", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    const { timeMin, timeMax } = next30DaysWindow(now);
    expect(timeMin).toBe("2026-05-01T00:00:00.000Z");
    expect(timeMax).toBe("2026-05-31T00:00:00.000Z");
  });

  it("respects custom day count", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    const { timeMax } = next30DaysWindow(now, 7);
    expect(timeMax).toBe("2026-05-08T00:00:00.000Z");
  });
});
