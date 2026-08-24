import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/** What getCurrentProfile actually returns — see PROFILE_COLUMNS. */
type Profile = Omit<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "google_refresh_token"
  | "google_access_token"
  | "google_token_expires_at"
  | "google_scopes"
>;

/** What the app actually uses off the session: an id, and one label. */
export type SessionUser = { id: string; email: string | null };

/**
 * The authenticated user for the current request.
 *
 * `getClaims()` rather than `getUser()`. `getUser()` asks the Auth server "is
 * this token still valid right now" — a network round-trip on every render.
 * `getClaims()` verifies the JWT's signature locally via WebCrypto against a
 * cached JWKS, so on a project using asymmetric signing keys it costs nothing.
 * On a project still using the symmetric secret it falls back to a
 * getUser()-equivalent request, so this is a safe swap either way: the worst
 * case is exactly what today costs.
 *
 * THE TRADE, stated because it is a real one: the token is trusted until it
 * expires. Revoking a session or banning a user now takes effect within one
 * token lifetime instead of immediately. Shortening the JWT expiry narrows
 * that window at the cost of more refreshes.
 *
 * Still wrapped in React.cache() so every server component in one render —
 * layout, sidebar, page, helpers — shares a single validation.
 *
 * The line this draws, deliberately: READS go through here and are cheap.
 * WRITES — the server actions and API routes — keep calling `getUser()`
 * directly, because "is this session still valid right now" is exactly the
 * question worth a round-trip before mutating something, and a write happens
 * once per click rather than several times per render. So a revoked session
 * can still browse until its token expires, and cannot change anything.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  return { id: sub, email: data.claims.email ?? null };
});

/** Current user's profile row (null when unauthenticated). Cached per request. */
/**
 * Columns a session may read off its own profile row.
 *
 * Explicit rather than `*` because migration 029 revokes SELECT on the four
 * `google_*` token columns from `authenticated` — they are service-role only,
 * as migration 012's own comment always said they should be. A `select("*")`
 * expands to every column and would fail outright against that grant.
 *
 * `google_email` stays: it is the user's own connected address, it is what the
 * settings screen shows, and disconnecting nulls it — so it doubles as the
 * "is Google connected" signal that used to read the refresh token.
 */
const PROFILE_COLUMNS =
  "id, email, full_name, avatar_url, locale, role, google_email, created_at, updated_at";

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  return (data ?? null) as Profile | null;
});

export async function isOwner(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.role === "owner";
}
