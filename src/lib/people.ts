import "server-only";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant-server";
import { isAppRole } from "@/lib/app-roles";

export interface Person {
  id: string;
  label: string;
}

/**
 * The people who can be assigned work, in the tenant you are looking at.
 *
 * Every picker in the app used to read `profiles` — three with no filter at
 * all, and one with `.eq("role", "staff")`. That column is the legacy enum:
 * the signup trigger writes its `'staff'` default and NOTHING in this
 * repository ever changes it, so the filter matched every account ever
 * created, and the unfiltered three matched those plus every other tenant's.
 *
 * The consequence arrived with the portal: invite a client to their own
 * portal, and their name appears in "assign this task to…" beside the
 * studio's staff.
 *
 * `tenant_members` is the table the app actually runs on. It is scoped to one
 * tenant, it is written on every invite, and it carries the real vocabulary —
 * so `client` can be excluded by meaning rather than by hope.
 */
export const listAssignablePeople = cache(async (): Promise<Person[]> => {
  const [supabase, tenant] = await Promise.all([
    createClient(),
    getCurrentTenant(),
  ]);

  const { data: members } = await supabase
    .from("tenant_members")
    .select("user_id, role")
    .eq("tenant_id", tenant.id);

  const staff = (members ?? []).filter(
    (m) => isAppRole(m.role) && m.role !== "client",
  );
  if (!staff.length) return [];

  // No FK from tenant_members to profiles — it points at auth.users — so the
  // names come in a second read rather than an embed.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in(
      "id",
      staff.map((m) => m.user_id),
    );

  return (profiles ?? [])
    .map((p) => ({ id: p.id, label: p.full_name ?? p.email ?? p.id }))
    .sort((a, b) => a.label.localeCompare(b.label));
});
