import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Row aliases for the project tables, plus the picker query shared by the two
 * task forms.
 *
 * 048 and 052 are applied, so every row here is generated and every call site
 * uses the normal client. The loose accessor that used to live here — and the
 * one in finance-db.ts — existed only while the migrations were written but
 * unapplied, and are gone.
 */
type T = Database["public"]["Tables"];

export type ProjectRow = T["projects"]["Row"];
export type ProjectProgressRow =
  Database["public"]["Functions"]["project_task_progress"]["Returns"][number];

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

