import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildAuthUrl,
  generateState,
  readCredentials,
  STATE_COOKIE,
  STATE_COOKIE_MAX_AGE_SEC,
} from "@/lib/google";

export const dynamic = "force-dynamic";

/**
 * Start the Google OAuth flow. Requires an authenticated Nest user — Google's
 * tokens land on `profiles` by user id. We generate a CSRF state, stash it in
 * an httpOnly cookie, and redirect the browser to Google's consent screen.
 *
 * Responses:
 *   - 302 → Google consent URL (happy path)
 *   - 401 when there's no Nest session
 *   - 503 when Google OAuth env vars are missing (with structured `missing[]`)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const credsResult = readCredentials();
  if (!credsResult.ok) {
    return NextResponse.json(
      { error: "google_creds_missing", missing: credsResult.missing },
      { status: 503 },
    );
  }

  const state = generateState();
  const url = buildAuthUrl({
    clientId: credsResult.creds.clientId,
    redirectUri: credsResult.creds.redirectUri,
    state,
  });

  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_COOKIE_MAX_AGE_SEC,
  });
  return response;
}
