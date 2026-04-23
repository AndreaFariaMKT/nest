import { describe, expect, it } from "vitest";
import {
  buildContainerUrl,
  buildMediaUrl,
  buildPublishUrl,
  DEFAULT_API_VERSION,
  GRAPH_BASE,
  hasCredentials,
  readCredentials,
} from "@/lib/instagram";

describe("readCredentials", () => {
  it("reports missing env vars by name", () => {
    const result = readCredentials({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual([
        "META_LONG_LIVED_TOKEN",
        "INSTAGRAM_BUSINESS_ACCOUNT_ID",
      ]);
    }
  });

  it("uses default API version when unset", () => {
    const result = readCredentials({
      META_LONG_LIVED_TOKEN: "t",
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.creds.apiVersion).toBe(DEFAULT_API_VERSION);
  });

  it("respects META_GRAPH_API_VERSION override", () => {
    const result = readCredentials({
      META_LONG_LIVED_TOKEN: "t",
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "1",
      META_GRAPH_API_VERSION: "v20.0",
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.creds.apiVersion).toBe("v20.0");
  });

  it("treats whitespace-only values as missing", () => {
    const result = readCredentials({
      META_LONG_LIVED_TOKEN: "   ",
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "1",
    });
    expect(result.ok).toBe(false);
  });
});

describe("hasCredentials", () => {
  it("mirrors readCredentials.ok", () => {
    expect(hasCredentials({})).toBe(false);
    expect(
      hasCredentials({
        META_LONG_LIVED_TOKEN: "t",
        INSTAGRAM_BUSINESS_ACCOUNT_ID: "1",
      }),
    ).toBe(true);
  });
});

describe("URL builders", () => {
  const creds = {
    token: "ignored-in-url",
    igBusinessAccountId: "178000000",
    apiVersion: "v21.0",
  };

  it("buildMediaUrl", () => {
    expect(buildMediaUrl(creds)).toBe(
      `${GRAPH_BASE}/v21.0/178000000/media`,
    );
  });

  it("buildPublishUrl", () => {
    expect(buildPublishUrl(creds)).toBe(
      `${GRAPH_BASE}/v21.0/178000000/media_publish`,
    );
  });

  it("buildContainerUrl includes the container id only", () => {
    expect(buildContainerUrl(creds, "18000000_abc")).toBe(
      `${GRAPH_BASE}/v21.0/18000000_abc`,
    );
  });
});
