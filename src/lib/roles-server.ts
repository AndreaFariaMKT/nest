import { cache } from "react";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant-server";
import { isAppRole, type AppRole } from "@/lib/roles";

export const VIEW_ROLE_COOKIE = "nest-view-role";

/** Map any legacy tenant_members.role value onto an app role. */
function mapRole(role: string | null | undefined): AppRole {
  if (isAppRole(role)) return role;
  // The legacy values this app actually wrote before app roles existed. Named
  // explicitly so they keep mapping to what they meant.
  if (role === "owner" || role === "admin") return "founder";
  if (role === "member" || role === "staff") return "manager";
  // Anything else is a value nobody planned for — including the null a user
  // with NO membership row for the active tenant produces. That used to land
  // on "manager", which carries coordinate + publish, so such a user was
  // handed the capability to register publishing credentials. The tenant floor
  // denied every read and write behind it, but that floor was the only layer
  // and it does not cover `profiles`. Fail closed instead.
  return "client";
}

/** The user's real role for the active tenant (their login's view). */
export const getActualRole = cache(async (): Promise<AppRole> => {
  const user = await getSessionUser();
  if (!user) return "client";
  const tenant = await getCurrentTenant();
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  return mapRole(data?.role);
});

/** Founder-only preview role, from the cookie (null = view as yourself). */
export async function getViewRole(): Promise<AppRole | null> {
  const store = await cookies();
  const v = store.get(VIEW_ROLE_COOKIE)?.value;
  return isAppRole(v) ? v : null;
}

/** The role the UI should render for: actual role, or a founder's preview. */
export const getCurrentRole = cache(async (): Promise<AppRole> => {
  const actual = await getActualRole();
  if (actual !== "founder") return actual;
  return (await getViewRole()) ?? "founder";
});
