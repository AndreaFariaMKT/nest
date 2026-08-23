import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "@/types/database.gen";

/**
 * The request-scoped client every page and server action reads through.
 *
 * The `Database` generic is what makes `.from()/.select()` typed at all —
 * without it this is `SupabaseClient<any>` and a query against a column no
 * migration has created still compiles. The cast is the price of one version
 * skew: `@supabase/ssr` 0.5.2 declares its return as
 * `SupabaseClient<Database, SchemaName, Schema>`, and `supabase-js` 2.104
 * reordered those parameters, so the schema resolves to `never` and every
 * table comes back untyped. Passing the generic through by hand restores it.
 * Delete the cast when `@supabase/ssr` is upgraded (0.12.x at time of writing).
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — setting cookies there is a no-op.
            // Session refresh happens in middleware instead.
          }
        },
      },
    },
  ) as unknown as SupabaseClient<Database>;
}
