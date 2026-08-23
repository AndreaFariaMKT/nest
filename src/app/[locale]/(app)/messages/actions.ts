"use server";

import { revalidatePath } from "next/cache";

import { dbError } from "@/lib/db-error";
import { log } from "@/lib/log";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { currentTenantId } from "@/lib/tenant-server";

export type SendState = { ok: boolean; error?: string };

/**
 * Rooms, not one inbox.
 *
 *   client_id null            → the tenant-wide internal channel
 *   client_id set, room=team  → production talk about that client; the client
 *                               never sees it
 *   client_id set, room=client→ the room the client reads and writes in
 *
 * The split is enforced in RLS too (migration 020) — this is the app half.
 */
export async function sendMessageAction(
  _prev: SendState,
  formData: FormData,
): Promise<SendState> {
  const body = (formData.get("body") ?? "").toString().trim();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const clientIdRaw = (formData.get("client_id") ?? "").toString().trim();
  const clientId = clientIdRaw.length ? clientIdRaw : null;
  const roomRaw = (formData.get("room") ?? "").toString().trim();
  // Without a client there is only the team channel; with one, default to the
  // room the client can see, since that is the safer mistake to make loudly.
  const room = !clientId ? "team" : roomRaw === "team" ? "team" : "client";
  if (!body) return { ok: false };

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const tenantId = await currentTenantId();
  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    tenant_id: tenantId,
    sender_id: user.id,
    body,
    client_id: clientId,
    room,
  });
  if (error) {
    // Reached from the PORTAL: portal/content/CycleFeedback.tsx calls this
    // action directly, and FormData is entirely caller-controlled. A tampered
    // client_id is refused by portal_room_floor, and the raw message would
    // hand the client `new row violates row-level security policy for table
    // "messages"` — plus a distinguishable 42501-vs-23503 that works as a
    // client-uuid validation oracle.
    log.error("messages.send", "write_failed", { code: error.code });
    return { ok: false, error: dbError(error) };
  }

  revalidatePath(`/${locale}/messages`);
  revalidatePath(`/${locale}/portal/messages`);
  return { ok: true };
}
