"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { currentTenantId } from "@/lib/tenant-server";

export type SendState = { ok: boolean; error?: string };

export async function sendMessageAction(
  _prev: SendState,
  formData: FormData,
): Promise<SendState> {
  const body = (formData.get("body") ?? "").toString().trim();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const clientIdRaw = (formData.get("client_id") ?? "").toString().trim();
  const clientId = clientIdRaw.length ? clientIdRaw : null;
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
  });
  if (error) return { ok: false, error: error.message };

  // Team channel or the client's chat, depending on client_id.
  revalidatePath(`/${locale}/${clientId ? "portal/messages" : "messages"}`);
  return { ok: true };
}
