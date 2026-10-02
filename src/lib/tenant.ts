import type { Theme } from "@/lib/theme";

/**
 * Tenants are fixed and few (AFM, Nest), so we hardcode their ids — matching
 * supabase/migrations/013_tenancy.sql. Pure module (safe in client components
 * and Edge middleware).
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

/**
 * The house a login is working in, for a login in more than one.
 *
 * The cookie holds the choice the switcher made; the header carries it to
 * PostgREST, where current_tenant_id() (migration 059) validates it against
 * tenant_members and the RLS floor scopes every tenant-owned table to it.
 * Neither is trusted on its own — a value naming a house the login does not
 * belong to is ignored on both sides.
 */
export const TENANT_COOKIE = "nest-tenant";
export const TENANT_HEADER = "x-nest-tenant";

/**
 * Pick the active tenant from a login's memberships and its stored choice.
 *
 * The choice wins when the login belongs to it; otherwise the lowest tenant
 * id, which is the rule current_tenant_id() applies in the database. The two
 * must agree: if the app and the database disagreed, a page would render one
 * house's name over the other house's rows.
 */
export function pickTenantId(
  memberships: readonly string[],
  chosen: string | null | undefined,
): string | null {
  if (chosen && memberships.includes(chosen)) return chosen;
  // Lowercase hex in a fixed layout sorts as text exactly as uuid sorts in
  // Postgres.
  return [...memberships].sort()[0] ?? null;
}
