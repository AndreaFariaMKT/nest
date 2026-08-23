import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.gen";

/**
 * Service-role client — bypasses RLS. Server-side only, and only where the
 * caller has ALREADY established who is asking and what they may touch.
 *
 * It exists because RLS is row-level: it can say "this client may write this
 * row", but not "…and only these four columns, and only to these values". Where
 * that distinction matters — a portal client approving a piece, say — the write
 * happens here behind an explicit ownership check, and the permissive RLS
 * policy is left off entirely.
 *
 * Parameterised with `Database` on purpose. Without the generic this returns
 * `SupabaseClient<any>`, which makes every `.from()/.select()` in the codebase
 * untyped — that is how a cron shipped reading a column no migration had
 * created yet and still passed `tsc`. The generated types only protect the
 * surface they were generated for if they are actually attached to it.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
