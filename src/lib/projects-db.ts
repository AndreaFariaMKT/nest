import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Row aliases for the project tables, plus the picker query shared by the two
 * task forms.
 *
 * 048's tables are applied, so `projects` and `project_members` come from the
 * generated types and every call site uses the normal client.
 *
 * `project_flow_steps` (052) is NOT applied yet, and is the only reason the
 * loose accessor below still exists. It goes when 052 lands and `types:gen`
 * runs — see docs/pending-migrations.md.
 */
type T = Database["public"]["Tables"];

export type ProjectRow = T["projects"]["Row"];
export type ProjectMemberRow = T["project_members"]["Row"];

/** Still pending: 052. */
type PendingTables = "project_flow_steps";

/**
 * A project row as it will be once 052 is applied.
 *
 * 052 adds `flow_applied_at`, so the generated row does not carry it yet.
 * Every read that needs it goes through this alias, which means removing the
 * shim is deleting this type and its four uses — not hunting casts.
 */
export type ProjectRowWithFlow = ProjectRow & {
  flow_applied_at: string | null;
};

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
  supabase: SupabaseClient<Database>,
  tenantId: string,
  clientNameById: Map<string, string>,
  cap: number,
): Promise<Array<{ id: string; name: string; client_name: string | null }>> {
  const { data } = await supabase
    .from("projects")
    .select("id, name, client_id, status")
    .eq("tenant_id", tenantId)
    // A finished or abandoned engagement should not be offered for new work.
    // Its existing tasks keep pointing at it — this is the picker, not a
    // filter on what already exists.
    .in("status", ["negotiating", "active", "paused"])
    .order("name", { ascending: true })
    .limit(cap);

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    client_name: p.client_id ? clientNameById.get(p.client_id) ?? null : null,
  }));
}
