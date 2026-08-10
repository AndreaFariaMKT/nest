import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { DEFAULT_TENANT, TENANTS, TENANT_LIST, type Tenant } from "@/lib/tenant";

/**
 * The active tenant is determined by the LOGGED-IN USER's membership — a login
 * belongs to AFM or Nest, there is no in-app switch. If a user somehow belongs
 * to more than one tenant, we resolve deterministically by tenant id so it's
 * stable across requests. Cached per request.
 */
export const getCurrentTenant = cache(async (): Promise<Tenant> => {
  const user = await getSessionUser();
  if (!user) return TENANTS[DEFAULT_TENANT];

  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .order("tenant_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    TENANT_LIST.find((t) => t.id === data?.tenant_id) ?? TENANTS[DEFAULT_TENANT]
  );
});

/** Convenience: just the tenant id for query scoping. */
export async function currentTenantId(): Promise<string> {
  return (await getCurrentTenant()).id;
}
