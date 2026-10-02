import { cache } from "react";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import {
  DEFAULT_TENANT,
  TENANTS,
  TENANT_COOKIE,
  TENANT_LIST,
  pickTenantId,
  type Tenant,
} from "@/lib/tenant";
import { isTheme } from "@/lib/theme";

/**
 * Every house the logged-in user belongs to, with each tenant row's own name
 * and theme. One round trip, cached per request; the switcher and
 * getCurrentTenant() share it.
 */
export const getMyTenants = cache(async (): Promise<Tenant[]> => {
  const user = await getSessionUser();
  if (!user) return [];

  const supabase = await createClient();
  // Membership is read without the active-tenant floor: tenant_members and
  // tenants are policed by is_tenant_member(), so this lists all of them.
  const { data } = await supabase
    .from("tenant_members")
    .select("tenant_id, tenants(id, slug, name, theme)")
    .eq("user_id", user.id)
    .order("tenant_id", { ascending: true });

  return (data ?? []).map((m) => {
    const row = Array.isArray(m.tenants) ? m.tenants[0] : m.tenants;
    // The hardcoded map stays as the floor, not the source. It carries the two
    // ids this app is built around, so a membership row pointing at a tenant
    // the embed could not return still resolves to something coherent rather
    // than dropping the user into the wrong house.
    const known = TENANT_LIST.find((t) => t.id === m.tenant_id);
    return {
      id: m.tenant_id,
      slug: (known?.slug ?? row?.slug ?? DEFAULT_TENANT) as Tenant["slug"],
      name: row?.name ?? known?.name ?? m.tenant_id,
      // Validated, not trusted: `theme` drives which stylesheet and which mark
      // render, and an unrecognised value would leave the app unstyled.
      theme: isTheme(row?.theme) ? row.theme : (known?.theme ?? "nest"),
    };
  });
});

/**
 * The house the logged-in user is working in: the one the switcher stored in
 * the `nest-tenant` cookie when they belong to it, else their lowest tenant id.
 * The database resolves the same choice from the same cookie (forwarded as a
 * header by createClient) in current_tenant_id(), and pickTenantId() is the
 * rule both follow — so the name on the screen and the rows under it are the
 * same house. Cached per request.
 */
export const getCurrentTenant = cache(async (): Promise<Tenant> => {
  const mine = await getMyTenants();
  const chosen = (await cookies()).get(TENANT_COOKIE)?.value;
  const id = pickTenantId(
    mine.map((t) => t.id),
    chosen,
  );
  return mine.find((t) => t.id === id) ?? TENANTS[DEFAULT_TENANT];
});

/** Convenience: just the tenant id for query scoping. */
export async function currentTenantId(): Promise<string> {
  return (await getCurrentTenant()).id;
}
