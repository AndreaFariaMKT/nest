// Google OAuth 2.0 wrapper — auth URL builder, code exchange, refresh,
// and a thin token cache that proactively refreshes when within 60s of
// expiry.
//
// Scopes:
//   openid email profile           — user identity for display
//   .../auth/calendar              — list + create + edit events; auto-attaches
//                                    Meet links via conferenceData
//
// Required env (read by call sites, not this module — keeps it pure):
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   GOOGLE_OAUTH_REDIRECT_URI      (e.g. http://localhost:3000/api/google/callback)
//
// Pattern mirrors src/lib/instagram.ts: pure URL builders + a single
// `exchangeCode` / `refreshAccessToken` IO function + a typed error class.
// Pure helpers are unit-tested; the IO functions are smoke-tested only.

export const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";

export const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
] as const;

// ───────────────────────────────────────────────────────────────────────────
// Env guard
// ───────────────────────────────────────────────────────────────────────────

export type GoogleOAuthCreds = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type CredentialsResult =
  | { ok: true; creds: GoogleOAuthCreds }
  | { ok: false; missing: string[] };

export function readCredentials(
  env: Record<string, string | undefined> = process.env,
): CredentialsResult {
  const missing: string[] = [];
  const clientId = (env.GOOGLE_OAUTH_CLIENT_ID ?? "").trim();
  const clientSecret = (env.GOOGLE_OAUTH_CLIENT_SECRET ?? "").trim();
  const redirectUri = (env.GOOGLE_OAUTH_REDIRECT_URI ?? "").trim();
  if (!clientId) missing.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!redirectUri) missing.push("GOOGLE_OAUTH_REDIRECT_URI");
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, creds: { clientId, clientSecret, redirectUri } };
}

export function hasCredentials(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readCredentials(env).ok;
}

// ───────────────────────────────────────────────────────────────────────────
// Auth URL builder (pure)
// ───────────────────────────────────────────────────────────────────────────

export type AuthUrlParams = {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: readonly string[];
  /**
   * `consent` forces the consent screen even on subsequent connects, which is
   * the only reliable way to receive a refresh_token after the first time.
   * Default `consent` to keep the integration self-healing.
   */
  prompt?: "consent" | "none" | "select_account";
};

export function buildAuthUrl(p: AuthUrlParams): string {
  const params = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: (p.scopes ?? SCOPES).join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: p.prompt ?? "consent",
    state: p.state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Token exchange (code → tokens)
// ───────────────────────────────────────────────────────────────────────────

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null; // null on subsequent connects without prompt=consent
  expiresInSec: number;
  scopes: string[];
  tokenType: string;
  idToken: string | null;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

export async function exchangeCode(
  creds: GoogleOAuthCreds,
  code: string,
): Promise<TokenSet> {
  const body = new URLSearchParams({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: creds.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  return parseTokenResponse(response, "exchange_code");
}

export async function refreshAccessToken(
  creds: GoogleOAuthCreds,
  refreshToken: string,
): Promise<TokenSet> {
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  // Refresh responses do not include a new refresh_token; preserve the caller's.
  const set = await parseTokenResponse(response, "refresh_token");
  return { ...set, refreshToken: set.refreshToken ?? refreshToken };
}

async function parseTokenResponse(
  response: Response,
  origin: string,
): Promise<TokenSet> {
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new GoogleApiError({
      message: `Non-JSON token response (${response.status})`,
      code: "non_json",
      httpStatus: response.status,
      origin,
      raw: text,
    });
  }
  if (!response.ok || (body && typeof body === "object" && "error" in body)) {
    const err = body as { error?: string; error_description?: string };
    throw new GoogleApiError({
      message: err.error_description ?? err.error ?? `Token error (${response.status})`,
      code: err.error ?? "unknown",
      httpStatus: response.status,
      origin,
      raw: body,
    });
  }
  const raw = body as GoogleTokenResponse;
  if (!raw.access_token) {
    throw new GoogleApiError({
      message: "Token response missing access_token",
      code: "missing_access_token",
      httpStatus: response.status,
      origin,
      raw: body,
    });
  }
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token ?? null,
    expiresInSec: raw.expires_in ?? 3600,
    scopes: (raw.scope ?? "").split(" ").filter(Boolean),
    tokenType: raw.token_type ?? "Bearer",
    idToken: raw.id_token ?? null,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// User info (lightweight identity fetch)
// ───────────────────────────────────────────────────────────────────────────

export type GoogleUserInfo = {
  email: string;
  name: string | null;
  picture: string | null;
};

export async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new GoogleApiError({
      message: `Userinfo failed (${response.status})`,
      code: "userinfo_failed",
      httpStatus: response.status,
      origin: "userinfo",
      raw: text,
    });
  }
  const body = (await response.json()) as {
    email?: string;
    name?: string;
    picture?: string;
  };
  if (!body.email) {
    throw new GoogleApiError({
      message: "Userinfo missing email",
      code: "missing_email",
      httpStatus: response.status,
      origin: "userinfo",
      raw: body,
    });
  }
  return {
    email: body.email,
    name: body.name ?? null,
    picture: body.picture ?? null,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Expiry helpers (pure)
// ───────────────────────────────────────────────────────────────────────────

const REFRESH_LEAD_MS = 60_000;

/** ISO timestamp `expiresInSec` seconds from `now`. */
export function expiresAtIso(expiresInSec: number, now: Date = new Date()): string {
  return new Date(now.getTime() + expiresInSec * 1000).toISOString();
}

/** True when `expiresAt` is past, missing, or within the 60s lead window. */
export function isAccessTokenStale(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return true;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return true;
  return t - now.getTime() <= REFRESH_LEAD_MS;
}

// ───────────────────────────────────────────────────────────────────────────
// State token (CSRF) — short-lived random hex stored in httpOnly cookie
// ───────────────────────────────────────────────────────────────────────────

export const STATE_COOKIE = "nest_google_oauth_state";
export const STATE_COOKIE_MAX_AGE_SEC = 600; // 10 min

/** 32-byte hex token, 64 chars. */
export function generateState(
  randomBytes: (len: number) => Uint8Array = defaultRandomBytes,
): string {
  const bytes = randomBytes(32);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function defaultRandomBytes(len: number): Uint8Array {
  const out = new Uint8Array(len);
  crypto.getRandomValues(out);
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// Errors
// ───────────────────────────────────────────────────────────────────────────

export class GoogleApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly origin: string;
  readonly raw: unknown;

  constructor(params: {
    message: string;
    code: string;
    httpStatus: number;
    origin: string;
    raw: unknown;
  }) {
    super(params.message);
    this.name = "GoogleApiError";
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    this.origin = params.origin;
    this.raw = params.raw;
  }
}
