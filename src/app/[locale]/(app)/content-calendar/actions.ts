"use server";

import { revalidatePath } from "next/cache";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { canMoveToBucket } from "@/lib/content-board";
import { log } from "@/lib/log";

export type BoardState = { ok: boolean; error?: string };

/**
 * Move a draft to another column of the content calendar.
 *
 * Reached two ways — a drag, and a plain form submit from the card's own menu
 * — and both land here, so the keyboard path is not a lesser version of the
 * mouse one. `canMoveToBucket` is the only thing that decides.
 */
export async function moveDraftToBucketAction(
  _prev: BoardState,
  formData: FormData,
): Promise<BoardState> {
  const id = (formData.get("id") ?? "").toString();
  const bucket = (formData.get("bucket") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id) return { ok: false, error: "notFound" };

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const { data: row } = await supabase
    .from("content_drafts")
    .select("id, status, engine")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const draft = row as { id: string; status: string; engine: string } | null;
  if (!draft) return { ok: false, error: "notFound" };
  // This board shows the content engine. A social piece moves through the
  // module's own stage machine, and writing its status from here would skip
  // every guard in it — the drift migration 026 was added to stop.
  if (draft.engine !== "content") return { ok: false, error: "notOnBoard" };

  const verdict = canMoveToBucket(draft.status, bucket);
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  // `.select()`: PostgREST reports an UPDATE that matched no row as success,
  // so without this an RLS refusal looks exactly like a move that worked.
  const { data: updated, error } = await supabase
    .from("content_drafts")
    .update({ status: verdict.status as never })
    .eq("id", draft.id)
    .eq("tenant_id", tenantId)
    .select("id")
    .maybeSingle();

  if (error) {
    log.error("content-calendar.move", "write_failed", {
      code: error.code ?? "unknown",
    });
    return { ok: false, error: "failed" };
  }
  if (!updated) return { ok: false, error: "notAllowed" };

  revalidatePath(`/${locale}/content-calendar`);
  revalidatePath(`/${locale}/content-engine`);
  return { ok: true };
}
