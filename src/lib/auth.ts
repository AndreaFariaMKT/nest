import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** Fetch the current user's profile row (null when unauthenticated). */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (data ?? null) as Profile | null;
}

export async function isOwner(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.role === "owner";
}
