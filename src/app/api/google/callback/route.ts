import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createAdminSupabase } from "@supabase/supabase-js";
import {
  exchangeCode,
  expiresAtIso,
  fetchUserInfo,
  GoogleApiError,
  readCredentials,
  STATE_COOKIE,
} from "@/lib/google";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Finish the Google OAuth flow. Verifies the CSRF state from the cookie set
 * by `/api/google/auth`, exchanges the code for tokens, fetches the Google
 * email, and persists everything onto the user's profile via service-role.
 *
 * Service-role is used because RLS on `profiles` doesn't allow a user to
 * update their own google_* columns directly (and we don't want to widen the
 * policy — the columns are server-managed by definition).
 *
 * Redirects:
 *   - On success: /settings?google=connected
 *   - On user-cancellable error: /settings?google=<reason>
 *   - On missing creds (operator config): 503 with structured response
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieState = request.cookies.get(STATE_COOKIE)?.value;

  // Bounce path — we always clear the state cookie and redirect back to
  // /settings with an explanatory query param. Operator-config failures
  // (missing env) keep returning 503 so they show up in monitoring.
  function bounce(reason: string): NextResponse {
    const target = new URL("/settings", url.origin);
    target.searchParams.set("google", reason);
    const response = NextResponse.redirect(target);
    response.cookies.delete(STATE_COOKIE);
    return response;
  }

  if (error) {
    log.warn("google.callback", "user_denied_or_error", { error });
    return bounce(error === "access_denied" ? "denied" : "error");
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    log.warn("google.callback", "state_mismatch", {
      hasCode: !!code,
      hasState: !!state,
      hasCookie: !!cookieState,
      match: state === cookieState,
    });
    return bounce("state_mismatch");
  }

  const credsResult = readCredentials();
  if (!credsResult.ok) {
    return NextResponse.json(
      { error: "google_creds_missing", missing: credsResult.missing },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return bounce("unauthorized");
  }

  let tokens;
  try {
    tokens = await exchangeCode(credsResult.creds, code);
  } catch (err) {
    if (err instanceof GoogleApiError) {
      log.error("google.callback", "exchange_failed", {
        code: err.code,
        httpStatus: err.httpStatus,
      });
      return bounce(`exchange_${err.code}`);
    }
    log.error("google.callback", "exchange_unknown_error", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return bounce("exchange_unknown");
  }

  let userInfo;
  try {
    userInfo = await fetchUserInfo(tokens.accessToken);
  } catch (err) {
    log.error("google.callback", "userinfo_failed", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return bounce("userinfo_failed");
  }

  // Persist on profiles. Use service-role: the user is authenticated (we
  // verified above) but `profiles.google_*` columns are server-managed.
  const admin = createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const update: Record<string, unknown> = {
    google_access_token: tokens.accessToken,
    google_token_expires_at: expiresAtIso(tokens.expiresInSec),
    google_email: userInfo.email,
    google_scopes: tokens.scopes,
  };
  // Refresh token only on first connect (or `prompt=consent` re-connect).
  // Don't overwrite an existing one with null.
  if (tokens.refreshToken) {
    update.google_refresh_token = tokens.refreshToken;
  }

  const { error: dbError } = await admin
    .from("profiles")
    .update(update)
    .eq("id", user.id);
  if (dbError) {
    log.error("google.callback", "profile_update_failed", {
      message: dbError.message,
    });
    return bounce("persist_failed");
  }

  log.info("google.callback", "connected", {
    userId: user.id,
    email: userInfo.email,
    scopes: tokens.scopes.length,
    hasRefreshToken: !!tokens.refreshToken,
  });

  return bounce("connected");
}
