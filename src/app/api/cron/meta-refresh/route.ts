import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";
import { log } from "@/lib/log";
import { env } from "@/lib/env";

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
 * ⚠ Current implementation is a ready-to-activate SHELL. It returns:
 *   - 401 on missing / wrong CRON_SECRET
 *   - 429 on rate limit
 *   - 503 when Meta creds are missing (with structured `missing[]`)
 *   - 501 when creds exist but refresh isn't wired up yet
 *
 * The 501 path keeps the endpoint self-documenting: deploy-time curl
 * gets a clear "not implemented" instead of a silent 200. Flip the 501
 * block to the real Graph call once credentials land.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`.
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

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "no_cron_secret" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
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

  // When creds land, replace this block with:
  //   const url = `https://graph.facebook.com/${apiVersion}/oauth/access_token`;
  //   const params = new URLSearchParams({
  //     grant_type: "fb_exchange_token",
  //     client_id: META_APP_ID,
  //     client_secret: META_APP_SECRET,
  //     fb_exchange_token: env.meta.token,
  //   });
  //   const res = await fetch(`${url}?${params}`);
  //   const body = await res.json();
  //   ...
  //   persist refreshed token to Vercel env via `vercel env` or to a secrets
  //   store; currently there's no writable secret store, so this step needs
  //   operator intervention. Until then we only refresh and return the new
  //   token in the response for the operator to copy.
  log.info("cron.meta-refresh", "refresh shell invoked");
  return NextResponse.json(
    {
      error: "not_implemented",
      message:
        "Meta credentials are configured but the token-refresh wiring hasn't shipped yet. " +
        "See src/app/api/cron/meta-refresh/route.ts for the follow-up plan.",
    },
    { status: 501 },
  );
}

export { handler as GET, handler as POST };
