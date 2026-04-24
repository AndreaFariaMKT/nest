import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildContainerUrl,
  buildMediaUrl,
  buildPublishUrl,
  buildRefreshUrl,
  DEFAULT_API_VERSION,
  GRAPH_BASE,
  hasCredentials,
  InstagramApiError,
  readCredentials,
  refreshLongLivedToken,
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

describe("buildRefreshUrl", () => {
  it("composes the oauth/access_token URL with grant_type=fb_exchange_token", () => {
    const url = buildRefreshUrl({
      apiVersion: "v21.0",
      appId: "APPID",
      appSecret: "SECRET",
      token: "CURRENT",
    });
    expect(url).toContain(`${GRAPH_BASE}/v21.0/oauth/access_token?`);
    expect(url).toContain("grant_type=fb_exchange_token");
    expect(url).toContain("client_id=APPID");
    expect(url).toContain("client_secret=SECRET");
    expect(url).toContain("fb_exchange_token=CURRENT");
  });

  it("URL-encodes special chars in secrets", () => {
    const url = buildRefreshUrl({
      apiVersion: "v21.0",
      appId: "a",
      appSecret: "s/+=",
      token: "t?x",
    });
    expect(url).toContain("client_secret=s%2F%2B%3D");
    expect(url).toContain("fb_exchange_token=t%3Fx");
  });
});

describe("refreshLongLivedToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseParams = {
    apiVersion: "v21.0",
    appId: "APPID",
    appSecret: "SECRET",
    token: "OLD",
  };

  it("returns access_token + tokenType + expiresInSec on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "NEWTOKEN",
          token_type: "bearer",
          expires_in: 5183944,
        }),
        { status: 200 },
      ),
    );
    const result = await refreshLongLivedToken(baseParams);
    expect(result).toEqual({
      accessToken: "NEWTOKEN",
      tokenType: "bearer",
      expiresInSec: 5183944,
    });
  });

  it("defaults tokenType to 'bearer' and expiresInSec to null when omitted", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "T" }), { status: 200 }),
    );
    const result = await refreshLongLivedToken(baseParams);
    expect(result.tokenType).toBe("bearer");
    expect(result.expiresInSec).toBeNull();
  });

  it("throws InstagramApiError with Graph error fields on non-2xx", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "Invalid app secret",
            code: 1,
            type: "OAuthException",
            error_subcode: 1234,
            fbtrace_id: "ABC",
          },
        }),
        { status: 400 },
      ),
    );
    await expect(refreshLongLivedToken(baseParams)).rejects.toMatchObject({
      name: "InstagramApiError",
      code: "1",
      type: "OAuthException",
      subcode: 1234,
      httpStatus: 400,
      fbtrace: "ABC",
    });
  });

  it("throws when body is 2xx but missing access_token", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ token_type: "bearer" }), { status: 200 }),
    );
    await expect(refreshLongLivedToken(baseParams)).rejects.toThrow(
      InstagramApiError,
    );
  });

  it("throws non_json error for non-JSON responses", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("<html>Bad gateway</html>", { status: 502 }),
    );
    await expect(refreshLongLivedToken(baseParams)).rejects.toMatchObject({
      name: "InstagramApiError",
      code: "non_json",
      httpStatus: 502,
    });
  });
});
