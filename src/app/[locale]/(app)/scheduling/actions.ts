"use server";

import { revalidatePath } from "next/cache";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { studioInstant } from "@/lib/social";
import { canReschedule } from "@/lib/scheduling";
import { log } from "@/lib/log";

export type RescheduleState = { ok: boolean; error?: string };

/**
 * Move a queued post to another slot.
 *
 * The date arrives as a `datetime-local` value, which carries no zone — so it
 * goes through `studioInstant` for the same reason `scheduleDraftAction` does:
 * read as the server's clock it lands three hours out, and the queue is built
 * on the studio's day.
 */
export async function reschedulePostAction(
  _prev: RescheduleState,
  formData: FormData,
): Promise<RescheduleState> {
  const id = (formData.get("id") ?? "").toString();
  const when = (formData.get("scheduled_for") ?? "").toString().trim();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id) return { ok: false, error: "notFound" };

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const { data: row } = await supabase
    .from("scheduled_posts")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const post = row as { id: string; status: string } | null;
  if (!post) return { ok: false, error: "notFound" };

  const verdict = canReschedule({
    status: post.status,
    iso: studioInstant(when),
    now: Date.now(),
  });
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  // `.select()`: an UPDATE that matched no row comes back as success from
  // PostgREST, so this is how an RLS refusal is told from a write.
  //
  // The status filter is not redundant with the check above — it is the guard
  // against the cron picking this row up between the read and the write. If
  // it has, the update matches nothing and the studio is told, rather than
  // silently moving the date on a post already going out.
  const { data: updated, error } = await supabase
    .from("scheduled_posts")
    .update({
      scheduled_for: verdict.iso,
      updated_at: new Date().toISOString(),
    })
    .eq("id", post.id)
    .eq("tenant_id", tenantId)
    .eq("status", post.status)
    .select("id")
    .maybeSingle();

  if (error) {
    log.error("scheduling.reschedule", "write_failed", {
      code: error.code ?? "unknown",
    });
    return { ok: false, error: "failed" };
  }
  if (!updated) return { ok: false, error: "inFlight" };

  revalidatePath(`/${locale}/scheduling`);
  return { ok: true };
}
