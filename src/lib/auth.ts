import { cache } from "react";
import type { User } from "@supabase/supabase-js";

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

/**
 * The authenticated user for the current request. Wrapped in React.cache() so
 * every server component in one render (layout, top bar, page, helpers) shares
 * a SINGLE auth validation instead of each doing its own remote round-trip to
 * Supabase Auth — the main source of per-click latency.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
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
