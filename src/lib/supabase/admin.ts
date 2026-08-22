import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. Server-side only, and only where the
 * caller has ALREADY established who is asking and what they may touch.
 *
 * It exists because RLS is row-level: it can say "this client may write this
 * row", but not "…and only these four columns, and only to these values". Where
 * that distinction matters — a portal client approving a piece, say — the write
 * happens here behind an explicit ownership check, and the permissive RLS
 * policy is left off entirely.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
