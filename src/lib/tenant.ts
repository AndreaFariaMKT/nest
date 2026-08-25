import type { Theme } from "@/lib/theme";

/**
 * Tenants are fixed and few (AFM, Nest), so we hardcode their ids — matching
 * supabase/migrations/0013_tenancy.sql — to resolve the current tenant from a
 * cookie with zero DB round-trips. Pure module (safe in client components).
 */
export type TenantSlug = "afm" | "nest";

export interface Tenant {
  id: string;
  slug: TenantSlug;
  name: string;
  theme: Theme;
}

export const TENANTS: Record<TenantSlug, Tenant> = {
  afm: {
    id: "00000000-0000-0000-0000-0000000000af",
    slug: "afm",
    name: "AFM",
    theme: "afm",
  },
  nest: {
    id: "00000000-0000-0000-0000-000000000e57",
    slug: "nest",
    name: "Nest",
    theme: "nest",
  },
};

export const TENANT_LIST: Tenant[] = [TENANTS.afm, TENANTS.nest];

/** Existing data belongs to AFM, so that's the default context. */
export const DEFAULT_TENANT: TenantSlug = "afm";

// TENANT_COOKIE and isTenantSlug lived here, for the cookie-based tenant
// switcher this module's header still describes. There is no switcher: the
// tenant comes from tenant_members, resolved in tenant-server.ts. The comment
// above is left as-is because the hardcoded ids are still true and still the
// reason this module can be imported anywhere.
