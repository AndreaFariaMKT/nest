import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { currentTenantId } from "@/lib/tenant-server";
import { getActualRole, getViewRole } from "@/lib/roles-server";

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
  const linked = (data as PortalClient | null) ?? null;
  if (linked) return linked;

  // A founder previewing as `client` is not any client's portal_user_id, so
  // the view returns nothing and every portal screen rendered an empty "not
  // linked yet" box. The one person who most needs to see what her clients see
  // could never see it. Fall back to the tenant's first client — read with her
  // own credentials, so this grants nothing she could not already open.
  if (await isPortalPreview()) {
    const { data: first } = await supabase
      .from("clients")
      .select("id, name, slug")
      .eq("tenant_id", tenantId)
      .neq("status", "archived")
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();
    return (first as PortalClient | null) ?? null;
  }

  return null;
});

/**
 * Is this a founder looking at the portal through "view as", rather than a
 * client looking at their own?
 *
 * The portal bands itself when so — a preview that looks identical to the real
 * thing is a good way to answer a client's question with the wrong client's
 * data in front of you.
 */
export const isPortalPreview = cache(async (): Promise<boolean> => {
  const [actual, view] = await Promise.all([getActualRole(), getViewRole()]);
  return actual === "founder" && view === "client";
});
