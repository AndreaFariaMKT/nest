import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProjectStatus, ProjectType } from "@/lib/projects";

/**
 * TEMPORARY — delete this file once migration 048 is applied and
 * `npm run types:gen` has run. Every import of it disappears with it.
 *
 * `database.gen.ts` is generated from the live schema, so `projects` and
 * `project_members` are not in it until 048 lands on the database that
 * types:gen reads. A brand-new table cannot be worked around the way a new
 * column can — `as never` on the payload is enough when the table exists, but
 * here `supabase.from("projects")` itself does not typecheck, because the
 * table name is not in the union.
 *
 * So the loose cast is confined to one place: the client, at the point of
 * `.from()`. The row shapes below stay honest and typed, so the pages and
 * actions that use them are checked as normal — what is unchecked is exactly
 * one edge, not the code built on it.
 */
export type ProjectRow = {
  id: string;
  tenant_id: string;
  client_id: string | null;
  name: string;
  slug: string;
  type: ProjectType;
  scope: string | null;
  status: ProjectStatus;
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectMemberRow = {
  project_id: string;
  user_id: string;
  tenant_id: string;
  role_on_project: string | null;
  created_at: string;
};

/** The two tables 048 adds, addressable before the generated types know them. */
type PendingTables = "projects" | "project_members";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = { from: (table: PendingTables) => any };

export function pending(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
): LooseClient {
  return supabase as unknown as LooseClient;
}

/**
 * The projects a task can be filed under, labelled the way the picker shows
 * them ("Cliente · Projeto"). Shared by the new-task and edit-task pages so
 * the query and the label shape do not drift apart.
 */
export async function listProjectChoices(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  tenantId: string,
  clientNameById: Map<string, string>,
  cap: number,
): Promise<Array<{ id: string; name: string; client_name: string | null }>> {
  const { data } = await pending(supabase)
    .from("projects")
    .select("id, name, client_id, status")
    .eq("tenant_id", tenantId)
    // A finished or abandoned engagement should not be offered for new work.
    // Its existing tasks keep pointing at it — this is the picker, not a
    // filter on what already exists.
    .in("status", ["negotiating", "active", "paused"])
    .order("name", { ascending: true })
    .limit(cap);

  return ((data ?? []) as Array<{
    id: string;
    name: string;
    client_id: string | null;
  }>).map((p) => ({
    id: p.id,
    name: p.name,
    client_name: p.client_id ? clientNameById.get(p.client_id) ?? null : null,
  }));
}
