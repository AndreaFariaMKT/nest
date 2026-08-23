import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { currentTenantId } from "@/lib/tenant-server";

export type PortalClient = { id: string; name: string; slug: string };

/**
 * The client record a "client" login is linked to (clients.portal_user_id).
 * Null when the account isn't linked yet. Cached per request.
 */
export const getPortalClient = cache(async (): Promise<PortalClient | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const tenantId = await currentTenantId();
  const supabase = await createClient();
  // The view, not the table (031). A portal login has no direct grant on
  // `clients` any more, because a row-level grant is a whole-row grant and
  // that row carries the studio's private notes and the portal bearer token.
  const { data } = await supabase
    .from("portal_client")
    .select("id, name, slug")
    .eq("tenant_id", tenantId)
    // The view already scopes to auth.uid() and excludes archived clients —
    // the same predicate owns_portal_client uses, so the two agree by
    // construction rather than by two people remembering to.
    .maybeSingle();
  return (data as PortalClient | null) ?? null;
});
