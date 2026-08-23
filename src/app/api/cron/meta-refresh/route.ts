import { NextResponse, type NextRequest } from "next/server";

import { checkCronAuth } from "@/lib/cron-auth";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";
import { log } from "@/lib/log";
import { env } from "@/lib/env";
import {
  DEFAULT_API_VERSION,
  InstagramApiError,
  refreshLongLivedToken,
} from "@/lib/instagram";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint — refreshes the Meta Long-Lived Token.
 *
 * Meta long-lived tokens expire after 60 days. Graph API's
 * `/oauth/access_token?grant_type=fb_exchange_token` returns a new one
 * given the current token + app id + app secret. We run daily so that
 * we're never within 30 days of expiry.
 *
 * Env required (checked via `env.meta.ok` + META_APP_ID + META_APP_SECRET):
 *   META_LONG_LIVED_TOKEN          — current token
 *   INSTAGRAM_BUSINESS_ACCOUNT_ID
 *   META_APP_ID                    — from Meta Business / App dashboard
 *   META_APP_SECRET                — same place
 *
 * Responses:
 *   - 200 { ok, previewNewToken, expiresInSec, expiresAt, reminder }
 *     — success. `reminder` tells the operator that the new token is
 *       NOT auto-persisted; they must update Vercel env + redeploy.
 *       previewNewToken shows a prefix + suffix only (full token logged
 *       by `log.info` at source, never returned in the API response).
 *   - 401 on missing / wrong CRON_SECRET
 *   - 429 on rate limit
 *   - 502 when Graph API refuses (invalid secret, revoked token, etc.)
 *   - 503 when Meta creds are missing (with structured `missing[]`)
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`.
 *
 * ⚠ Security: the full refreshed token is only emitted to the server's
 * log stream (`log.info`), never returned in the JSON response. This
 * matches Vercel's log access model (operator-only). If you're running
 * behind a log aggregator that forwards to less-trusted parties, gate
 * this further.
 */
async function handler(request: NextRequest) {
  const ip = ipFromHeaders(request.headers);
  const rl = checkRateLimit({
    key: `cron.meta-refresh:${ip}`,
    limit: 4,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetMs: rl.resetMs },
      { status: 429 },
    );
  }

  const auth = checkCronAuth(request.headers.get("authorization"));
  if (auth === "unset") {
    return NextResponse.json({ error: "no_cron_secret" }, { status: 500 });
  }
  if (auth !== "ok") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Surface missing env explicitly — operator reads Vercel logs + fixes.
  const missing: string[] = [];
  if (!env.meta.token) missing.push("META_LONG_LIVED_TOKEN");
  if (!env.meta.igAccountId) missing.push("INSTAGRAM_BUSINESS_ACCOUNT_ID");
  if (!process.env.META_APP_ID?.trim()) missing.push("META_APP_ID");
  if (!process.env.META_APP_SECRET?.trim()) missing.push("META_APP_SECRET");
  if (missing.length > 0) {
    log.warn("cron.meta-refresh", "missing env", { missing });
    return NextResponse.json(
      { error: "meta_creds_missing", missing },
      { status: 503 },
    );
  }

  const apiVersion =
    (process.env.META_GRAPH_API_VERSION ?? DEFAULT_API_VERSION).trim();

  let result;
  try {
    result = await refreshLongLivedToken({
      apiVersion,
      appId: process.env.META_APP_ID!.trim(),
      appSecret: process.env.META_APP_SECRET!.trim(),
      token: env.meta.token!,
    });
  } catch (err) {
    if (err instanceof InstagramApiError) {
      log.error("cron.meta-refresh", "refresh_failed", {
        code: err.code,
        type: err.type,
        httpStatus: err.httpStatus,
        fbtrace: err.fbtrace,
      });
      return NextResponse.json(
        {
          error: "refresh_failed",
          code: err.code,
          type: err.type,
          httpStatus: err.httpStatus,
        },
        { status: 502 },
      );
    }
    const message = err instanceof Error ? err.message : "unknown_error";
    log.error("cron.meta-refresh", "refresh_unknown_error", { message });
    return NextResponse.json(
      { error: "refresh_unknown_error", message },
      { status: 500 },
    );
  }

  // Full token lands only in the server log (Vercel log viewer is
  // operator-only). The JSON response shows a preview so monitoring can
  // detect rotations without carrying the secret over the wire to less
  // trusted consumers.
  const fullToken = result.accessToken;
  const preview = `${fullToken.slice(0, 12)}…${fullToken.slice(-6)}`;
  const expiresAt = result.expiresInSec
    ? new Date(Date.now() + result.expiresInSec * 1000).toISOString()
    : null;

  log.info("cron.meta-refresh", "refresh_success", {
    // Emits the full token to server logs — read with `vercel logs`.
    full_access_token: fullToken,
    preview,
    expiresInSec: result.expiresInSec,
    expiresAt,
  });

  return NextResponse.json({
    ok: true,
    previewNewToken: preview,
    tokenType: result.tokenType,
    expiresInSec: result.expiresInSec,
    expiresAt,
    reminder:
      "Token refreshed but NOT persisted. Copy the full token from the server " +
      "logs (`vercel logs` — look for full_access_token) into the " +
      "META_LONG_LIVED_TOKEN env var in Vercel → Project → Settings → " +
      "Environment Variables, then redeploy so the new token takes effect.",
  });
}

export { handler as GET, handler as POST };
