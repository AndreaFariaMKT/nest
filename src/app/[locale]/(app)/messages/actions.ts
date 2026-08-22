"use server";

import { revalidatePath } from "next/cache";

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
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/${locale}/messages`);
  revalidatePath(`/${locale}/portal/messages`);
  return { ok: true };
}
