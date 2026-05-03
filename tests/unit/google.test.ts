import { describe, expect, it } from "vitest";
import {
  AUTH_ENDPOINT,
  buildAuthUrl,
  expiresAtIso,
  generateState,
  hasCredentials,
  isAccessTokenStale,
  readCredentials,
  SCOPES,
  STATE_COOKIE,
  STATE_COOKIE_MAX_AGE_SEC,
} from "@/lib/google";

describe("readCredentials", () => {
  it("returns missing array when env vars unset", () => {
    const result = readCredentials({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual([
        "GOOGLE_OAUTH_CLIENT_ID",
        "GOOGLE_OAUTH_CLIENT_SECRET",
        "GOOGLE_OAUTH_REDIRECT_URI",
      ]);
    }
  });

  it("treats whitespace-only values as missing", () => {
    const result = readCredentials({
      GOOGLE_OAUTH_CLIENT_ID: "  ",
      GOOGLE_OAUTH_CLIENT_SECRET: "secret",
      GOOGLE_OAUTH_REDIRECT_URI: "http://localhost:3000/api/google/callback",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual(["GOOGLE_OAUTH_CLIENT_ID"]);
    }
  });

  it("returns trimmed creds when all set", () => {
    const result = readCredentials({
      GOOGLE_OAUTH_CLIENT_ID: " abc ",
      GOOGLE_OAUTH_CLIENT_SECRET: " sec ",
      GOOGLE_OAUTH_REDIRECT_URI: " http://x/cb ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.creds).toEqual({
        clientId: "abc",
        clientSecret: "sec",
        redirectUri: "http://x/cb",
      });
    }
  });
});

describe("hasCredentials", () => {
  it("delegates to readCredentials", () => {
    expect(hasCredentials({})).toBe(false);
    expect(
      hasCredentials({
        GOOGLE_OAUTH_CLIENT_ID: "a",
        GOOGLE_OAUTH_CLIENT_SECRET: "b",
        GOOGLE_OAUTH_REDIRECT_URI: "c",
      }),
    ).toBe(true);
  });
});

describe("buildAuthUrl", () => {
  const base = {
    clientId: "client-123",
    redirectUri: "http://localhost:3000/api/google/callback",
    state: "deadbeef",
  };

  it("starts with the Google OAuth endpoint", () => {
    const url = buildAuthUrl(base);
    expect(url.startsWith(AUTH_ENDPOINT + "?")).toBe(true);
  });

  it("includes the required OAuth params", () => {
    const url = new URL(buildAuthUrl(base));
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/google/callback",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("deadbeef");
    expect(url.searchParams.get("access_type")).toBe("offline");
  });

  it("defaults prompt to consent so refresh_token is reliably issued", () => {
    const url = new URL(buildAuthUrl(base));
    expect(url.searchParams.get("prompt")).toBe("consent");
  });

  it("includes the default Calendar scope set", () => {
    const url = new URL(buildAuthUrl(base));
    const scope = url.searchParams.get("scope") ?? "";
    for (const s of SCOPES) {
      expect(scope.split(" ")).toContain(s);
    }
  });

  it("respects custom scopes when provided", () => {
    const url = new URL(buildAuthUrl({ ...base, scopes: ["openid", "email"] }));
    expect(url.searchParams.get("scope")).toBe("openid email");
  });

  it("respects custom prompt when provided", () => {
    const url = new URL(buildAuthUrl({ ...base, prompt: "select_account" }));
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });
});

describe("expiresAtIso", () => {
  it("adds expiresInSec to now and returns ISO", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(expiresAtIso(3600, now)).toBe("2026-01-01T01:00:00.000Z");
  });
});

describe("isAccessTokenStale", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("treats null/undefined/invalid as stale", () => {
    expect(isAccessTokenStale(null, now)).toBe(true);
    expect(isAccessTokenStale(undefined, now)).toBe(true);
    expect(isAccessTokenStale("not a date", now)).toBe(true);
  });

  it("treats expiry within 60s lead window as stale", () => {
    expect(isAccessTokenStale("2026-01-01T00:00:30.000Z", now)).toBe(true);
    expect(isAccessTokenStale("2026-01-01T00:00:59.000Z", now)).toBe(true);
  });

  it("treats expiry beyond lead window as fresh", () => {
    expect(isAccessTokenStale("2026-01-01T00:01:01.000Z", now)).toBe(false);
    expect(isAccessTokenStale("2026-01-01T01:00:00.000Z", now)).toBe(false);
  });
});

describe("generateState", () => {
  it("returns 64 hex chars (32 bytes) by default", () => {
    const state = generateState();
    expect(state).toMatch(/^[0-9a-f]{64}$/);
  });

  it("uses the injected randomBytes for determinism in tests", () => {
    const state = generateState((len) => new Uint8Array(len).fill(0xab));
    expect(state).toBe("ab".repeat(32));
  });
});

describe("STATE_COOKIE constants", () => {
  it("exposes a stable cookie name + 10-min TTL", () => {
    expect(STATE_COOKIE).toBe("nest_google_oauth_state");
    expect(STATE_COOKIE_MAX_AGE_SEC).toBe(600);
  });
});
