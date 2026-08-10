import { cache } from "react";
import { cookies } from "next/headers";

import {
  DEFAULT_TENANT,
  TENANTS,
  TENANT_COOKIE,
  isTenantSlug,
  type Tenant,
} from "@/lib/tenant";

/**
 * The active tenant for the current request, from the cookie (defaults to AFM).
 * Cached per request. Use `.id` to scope queries: `.eq("tenant_id", tenant.id)`.
 */
export const getCurrentTenant = cache(async (): Promise<Tenant> => {
  const store = await cookies();
  const v = store.get(TENANT_COOKIE)?.value;
  return TENANTS[isTenantSlug(v) ? v : DEFAULT_TENANT];
});

/** Convenience: just the tenant id for query scoping. */
export async function currentTenantId(): Promise<string> {
  return (await getCurrentTenant()).id;
}
