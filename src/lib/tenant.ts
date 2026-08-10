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

export const TENANT_COOKIE = "nest-tenant";
/** Existing data belongs to AFM, so that's the default context. */
export const DEFAULT_TENANT: TenantSlug = "afm";

export function isTenantSlug(v: string | undefined): v is TenantSlug {
  return v === "afm" || v === "nest";
}
