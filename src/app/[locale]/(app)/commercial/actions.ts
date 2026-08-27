"use server";

import { revalidatePath } from "next/cache";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { cleanText } from "@/lib/sanitize";
import { applyMove } from "@/lib/pipeline";
import { log } from "@/lib/log";

export type PipelineState = { ok: boolean; error?: string };

/**
 * Move a prospect along the commercial conversation, or win it.
 *
 * The rules are in `@/lib/pipeline` and tested there. This reads the row,
 * asks, and writes what it is told — it does not decide anything itself, so a
 * stage cannot mean one thing on the board and another here.
 */
export async function movePipelineAction(
  _prev: PipelineState,
  formData: FormData,
): Promise<PipelineState> {
  const id = (formData.get("id") ?? "").toString();
  const move = (formData.get("move") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const reason = cleanText((formData.get("reason") ?? "").toString(), {
    maxLength: 500,
  });
  if (!id) return { ok: false, error: "notFound" };

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const { data: row } = await supabase
    .from("clients")
    .select("id, status, pipeline_stage, notes")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const client = row as {
    id: string;
    status: string;
    pipeline_stage: string | null;
    notes: string | null;
  } | null;
  if (!client) return { ok: false, error: "notFound" };

  const verdict = applyMove({
    move,
    status: client.status,
    pipeline_stage: client.pipeline_stage,
    reason,
  });
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const patch: Record<string, unknown> = {
    pipeline_stage: verdict.stage,
    status: verdict.status,
    updated_at: new Date().toISOString(),
  };

  // A loss keeps its reason on the client rather than in a table of its own:
  // the next person to open this record is reading `notes`, and a reason
  // filed somewhere else is a reason nobody sees.
  if (move === "lose" && reason) {
    const stamp = new Date().toISOString().slice(0, 10);
    patch.notes = [client.notes, `[${stamp}] ${reason}`]
      .filter(Boolean)
      .join("\n\n");
  }

  // `.select()` on purpose. PostgREST answers an UPDATE that matched no row
  // with `{ error: null }`, so a write refused by RLS is indistinguishable
  // from one that worked — the same trap `social/actions.ts` documents. If
  // nothing comes back, nothing was written.
  const { data: updated, error } = await supabase
    .from("clients")
    // The generated types still describe `clients` as migration 045 found it,
    // with no `pipeline_stage`. `npm run types:gen` once 045 is applied drops
    // this cast.
    .update(patch as never)
    .eq("id", client.id)
    .eq("tenant_id", tenantId)
    .select("id")
    .maybeSingle();

  if (error) {
    log.error("commercial.pipeline", "write_failed", {
      code: error.code ?? "unknown",
    });
    return { ok: false, error: "failed" };
  }
  if (!updated) return { ok: false, error: "notAllowed" };

  revalidatePath(`/${locale}/commercial`);
  revalidatePath(`/${locale}/clients`);
  return { ok: true };
}
