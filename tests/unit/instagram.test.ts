import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildContainerUrl,
  buildMediaUrl,
  buildPublishUrl,
  buildRefreshUrl,
  createCarousel,
  createCarouselItem,
  DEFAULT_API_VERSION,
  getContainerStatus,
  GRAPH_BASE,
  hasCredentials,
  InstagramApiError,
  publish,
  publishCarousel,
  readCredentials,
  refreshLongLivedToken,
  waitForContainerReady,
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

// ─────────────────────────────────────────────────────────────────────────────
// Publishing pipeline — end-to-end mocked smoke
// ─────────────────────────────────────────────────────────────────────────────

const creds = {
  token: "TOK",
  igBusinessAccountId: "178IG",
  apiVersion: "v21.0",
};

function ok<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function graphError(
  code: number,
  message: string,
  status = 400,
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
        type: "OAuthException",
        fbtrace_id: "trace",
      },
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}

describe("createCarouselItem", () => {
  afterEach(() => vi.restoreAllMocks());

  it("POSTs to /media with image_url + is_carousel_item + access_token", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(ok({ id: "child_1" }));
    const result = await createCarouselItem(creds, "https://ex/a.png");
    expect(result).toEqual({ id: "child_1" });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`${GRAPH_BASE}/v21.0/178IG/media?`);
    expect(url).toContain("image_url=https%3A%2F%2Fex%2Fa.png");
    expect(url).toContain("is_carousel_item=true");
    expect(url).toContain("access_token=TOK");
    expect(init.method).toBe("POST");
  });

  it("surfaces Graph error as InstagramApiError", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      graphError(36001, "Image URL not accessible"),
    );
    await expect(
      createCarouselItem(creds, "https://bad/x.png"),
    ).rejects.toMatchObject({ name: "InstagramApiError", code: "36001" });
  });
});

describe("createCarousel", () => {
  afterEach(() => vi.restoreAllMocks());

  it("POSTs with media_type=CAROUSEL + children + caption", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(ok({ id: "carousel_1" }));
    const result = await createCarousel(
      creds,
      ["c1", "c2", "c3"],
      "My caption #test",
    );
    expect(result).toEqual({ id: "carousel_1" });

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("media_type=CAROUSEL");
    expect(url).toContain("children=c1%2Cc2%2Cc3");
    expect(url).toContain("caption=My+caption+%23test");
  });

  it("rejects fewer than 2 children before calling fetch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    await expect(createCarousel(creds, ["c1"], "cap")).rejects.toThrow(
      /2–10 children/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects more than 10 children before calling fetch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const tooMany = Array.from({ length: 11 }, (_, i) => `c${i}`);
    await expect(createCarousel(creds, tooMany, "cap")).rejects.toThrow(
      /2–10 children/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("getContainerStatus", () => {
  afterEach(() => vi.restoreAllMocks());

  it("GETs the container with fields=status_code", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(ok({ status_code: "FINISHED", id: "carousel_1" }));
    const result = await getContainerStatus(creds, "carousel_1");
    expect(result.status_code).toBe("FINISHED");
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`${GRAPH_BASE}/v21.0/carousel_1?`);
    expect(url).toContain("fields=status_code");
    expect(init?.method ?? "GET").toBe("GET");
  });
});

describe("publish", () => {
  afterEach(() => vi.restoreAllMocks());

  it("POSTs to /media_publish with creation_id", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(ok({ id: "published_1" }));
    const result = await publish(creds, "carousel_1");
    expect(result).toEqual({ id: "published_1" });
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`${GRAPH_BASE}/v21.0/178IG/media_publish?`);
    expect(url).toContain("creation_id=carousel_1");
  });
});

describe("waitForContainerReady", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns immediately when first poll is FINISHED", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      ok({ status_code: "FINISHED", id: "c" }),
    );
    await expect(
      waitForContainerReady(creds, "c", { timeoutMs: 100, intervalMs: 10 }),
    ).resolves.toBeUndefined();
  });

  it("polls until FINISHED", async () => {
    let call = 0;
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      call += 1;
      return ok({
        status_code: call < 3 ? "IN_PROGRESS" : "FINISHED",
        id: "c",
      });
    });
    await expect(
      waitForContainerReady(creds, "c", { timeoutMs: 500, intervalMs: 5 }),
    ).resolves.toBeUndefined();
    expect(call).toBeGreaterThanOrEqual(3);
  });

  it("throws on ERROR status", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      ok({ status_code: "ERROR", id: "c" }),
    );
    await expect(
      waitForContainerReady(creds, "c", { timeoutMs: 100, intervalMs: 5 }),
    ).rejects.toMatchObject({ name: "InstagramApiError", code: "container_status" });
  });

  it("throws on EXPIRED status", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      ok({ status_code: "EXPIRED", id: "c" }),
    );
    await expect(
      waitForContainerReady(creds, "c", { timeoutMs: 100, intervalMs: 5 }),
    ).rejects.toMatchObject({ code: "container_status" });
  });

  it("throws timeout error when the total wait exceeds timeoutMs", async () => {
    // Fresh Response per call — Response bodies can only be read once.
    vi.spyOn(global, "fetch").mockImplementation(async () =>
      ok({ status_code: "IN_PROGRESS", id: "c" }),
    );
    await expect(
      waitForContainerReady(creds, "c", { timeoutMs: 30, intervalMs: 5 }),
    ).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("publishCarousel (pipeline)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("runs children → carousel → wait → publish and returns both ids", async () => {
    const sequence = [
      ok({ id: "child_a" }), // createCarouselItem 1
      ok({ id: "child_b" }), // createCarouselItem 2
      ok({ id: "child_c" }), // createCarouselItem 3
      ok({ id: "carousel_42" }), // createCarousel
      ok({ status_code: "FINISHED", id: "carousel_42" }), // waitForContainerReady
      ok({ id: "published_99" }), // publish
    ];
    let i = 0;
    vi.spyOn(global, "fetch").mockImplementation(async () => sequence[i++]);

    const result = await publishCarousel(
      creds,
      ["https://ex/1.png", "https://ex/2.png", "https://ex/3.png"],
      "My caption",
    );
    expect(result).toEqual({
      publishedId: "published_99",
      containerId: "carousel_42",
    });
    expect(i).toBe(6);
  });

  it("reraises a child-creation failure without calling subsequent steps", async () => {
    // publishCarousel fires N child creations in parallel. With 2 urls we
    // have one success + one failure; Promise.all rejects with the first
    // error so carousel/wait/publish never fire.
    const sequence = [ok({ id: "child_a" }), graphError(100, "Image too large")];
    let i = 0;
    vi.spyOn(global, "fetch").mockImplementation(async () => sequence[i++]);

    await expect(
      publishCarousel(creds, ["a", "b"], "cap"),
    ).rejects.toMatchObject({ name: "InstagramApiError", code: "100" });
    // Exactly the 2 children fetches ran.
    expect(i).toBe(2);
  });

  it("reraises a wait-phase EXPIRED as container_status error", async () => {
    const sequence = [
      ok({ id: "ca" }),
      ok({ id: "cb" }),
      ok({ id: "carousel_x" }),
      ok({ status_code: "EXPIRED", id: "carousel_x" }),
    ];
    let i = 0;
    vi.spyOn(global, "fetch").mockImplementation(async () => sequence[i++]);

    await expect(
      publishCarousel(creds, ["a", "b"], "cap"),
    ).rejects.toMatchObject({ code: "container_status" });
  });

  it("propagates validation failure when fewer than 2 image urls", async () => {
    // publishCarousel creates children in parallel first, THEN createCarousel
    // does the 2-10 check. With 1 image, we get one child successfully and
    // then the validation fires.
    vi.spyOn(global, "fetch").mockResolvedValue(ok({ id: "only_child" }));
    await expect(publishCarousel(creds, ["only"], "cap")).rejects.toThrow(
      /2–10 children/,
    );
  });
});
