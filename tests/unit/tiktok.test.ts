import { describe, expect, it } from "vitest";
import {
  buildInitBody,
  hasCredentials,
  initEndpoint,
  readCredentials,
  TIKTOK_BASE,
} from "@/lib/tiktok";

describe("readCredentials", () => {
  it("reports missing access token", () => {
    const result = readCredentials({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual(["TIKTOK_ACCESS_TOKEN"]);
    }
  });

  it("treats whitespace as missing", () => {
    expect(readCredentials({ TIKTOK_ACCESS_TOKEN: "   " }).ok).toBe(false);
  });

  it("defaults publishMode to inbox (works on unaudited apps)", () => {
    const result = readCredentials({ TIKTOK_ACCESS_TOKEN: "tok" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.creds.publishMode).toBe("inbox");
  });

  it("respects TIKTOK_PUBLISH_MODE=direct (case-insensitive)", () => {
    const result = readCredentials({
      TIKTOK_ACCESS_TOKEN: "tok",
      TIKTOK_PUBLISH_MODE: "DIRECT",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.creds.publishMode).toBe("direct");
  });

  it("falls back to inbox for unknown mode strings", () => {
    const result = readCredentials({
      TIKTOK_ACCESS_TOKEN: "tok",
      TIKTOK_PUBLISH_MODE: "weird",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.creds.publishMode).toBe("inbox");
  });
});

describe("hasCredentials", () => {
  it("delegates to readCredentials", () => {
    expect(hasCredentials({})).toBe(false);
    expect(hasCredentials({ TIKTOK_ACCESS_TOKEN: "x" })).toBe(true);
  });
});

describe("initEndpoint", () => {
  it("uses /inbox/ for inbox mode", () => {
    expect(initEndpoint("inbox")).toBe(
      `${TIKTOK_BASE}/post/publish/inbox/video/init/`,
    );
  });

  it("uses /publish/ for direct mode (post-audit)", () => {
    expect(initEndpoint("direct")).toBe(
      `${TIKTOK_BASE}/post/publish/video/init/`,
    );
  });
});

describe("buildInitBody", () => {
  const videoUrl = "https://example.com/video.mp4";

  it("emits PULL_FROM_URL with the video URL when no postInfo", () => {
    expect(buildInitBody({ videoUrl, publishMode: "inbox" })).toEqual({
      source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
    });
  });

  it("includes title when provided", () => {
    const body = buildInitBody({
      videoUrl,
      publishMode: "inbox",
      postInfo: { title: "Hello" },
    });
    expect(body.post_info?.title).toBe("Hello");
  });

  it("drops privacy_level in inbox mode (manual finalisation handles it)", () => {
    const body = buildInitBody({
      videoUrl,
      publishMode: "inbox",
      postInfo: { privacyLevel: "PUBLIC_TO_EVERYONE", title: "x" },
    });
    expect(body.post_info?.privacy_level).toBeUndefined();
  });

  it("includes privacy_level in direct mode (required by TikTok)", () => {
    const body = buildInitBody({
      videoUrl,
      publishMode: "direct",
      postInfo: { privacyLevel: "MUTUAL_FOLLOW_FRIENDS" },
    });
    expect(body.post_info?.privacy_level).toBe("MUTUAL_FOLLOW_FRIENDS");
  });

  it("forwards interaction toggles + cover timestamp", () => {
    const body = buildInitBody({
      videoUrl,
      publishMode: "inbox",
      postInfo: {
        disableDuet: true,
        disableComment: false,
        disableStitch: true,
        videoCoverTimestampMs: 2500,
      },
    });
    expect(body.post_info).toMatchObject({
      disable_duet: true,
      disable_comment: false,
      disable_stitch: true,
      video_cover_timestamp_ms: 2500,
    });
  });

  it("omits post_info entirely when nothing in it survives the inbox filter", () => {
    const body = buildInitBody({
      videoUrl,
      publishMode: "inbox",
      postInfo: { privacyLevel: "PUBLIC_TO_EVERYONE" }, // only field, dropped in inbox mode
    });
    expect(body.post_info).toBeUndefined();
  });
});
