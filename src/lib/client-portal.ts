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
  const { data } = await supabase
    .from("clients")
    .select("id, name, slug")
    .eq("tenant_id", tenantId)
    .eq("portal_user_id", user.id)
    // Agrees with owns_portal_client (029). Without it an archived client
    // would resolve here and then read nothing, which renders as an account
    // that is signed in and permanently empty rather than one that ended.
    .neq("status", "archived")
    .maybeSingle();
  return (data as PortalClient | null) ?? null;
});
