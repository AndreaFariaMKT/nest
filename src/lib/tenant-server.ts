import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { DEFAULT_TENANT, TENANTS, TENANT_LIST, type Tenant } from "@/lib/tenant";
import { isTheme } from "@/lib/theme";

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
  // The tenant row comes back with the membership, in one round trip. It used
  // to read only `tenant_id` and then look the rest up in a hardcoded map — so
  // `tenants.name`, `tenants.theme` and `tenants.branding` existed in the
  // schema, were seeded by migration 013, and were never read by anything. A
  // house could not be renamed or re-themed without a deploy.
  const { data } = await supabase
    .from("tenant_members")
    .select("tenant_id, tenants(id, slug, name, theme)")
    .eq("user_id", user.id)
    .order("tenant_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  const row = Array.isArray(data?.tenants) ? data.tenants[0] : data?.tenants;

  // The hardcoded map stays as the floor, not the source. It carries the two
  // ids this app is built around, so a membership row pointing at a tenant the
  // embed could not return still resolves to something coherent rather than
  // dropping the user into the wrong house.
  const known = TENANT_LIST.find((t) => t.id === data?.tenant_id);
  if (!row) return known ?? TENANTS[DEFAULT_TENANT];

  return {
    id: row.id,
    slug: (known?.slug ?? row.slug) as Tenant["slug"],
    name: row.name,
    // Validated, not trusted: `theme` drives which stylesheet and which mark
    // render, and an unrecognised value would leave the app unstyled.
    theme: isTheme(row.theme) ? row.theme : (known?.theme ?? "nest"),
  };
});

/** Convenience: just the tenant id for query scoping. */
export async function currentTenantId(): Promise<string> {
  return (await getCurrentTenant()).id;
}
