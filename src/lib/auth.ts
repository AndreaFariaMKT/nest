import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

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
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (data ?? null) as Profile | null;
});

export async function isOwner(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.role === "owner";
}
