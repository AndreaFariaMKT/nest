"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { dbError } from "@/lib/db-error";
import { log } from "@/lib/log";

/**
 * Same shape as the service links, and for the same reason: both were
 * `Promise<void>` with the write's error discarded, so a refusal looked
 * exactly like a success — the person simply did not appear on the client.
 */
export type MemberLinkResult = { ok: boolean; error?: string };

export async function attachClientMemberAction(
  formData: FormData,
): Promise<MemberLinkResult> {
  const clientId = (formData.get("clientId") ?? "").toString();
  const clientSlug = (formData.get("clientSlug") ?? "").toString();
  const userId = (formData.get("userId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!clientId || !userId) return { ok: false, error: "dbMissingField" };

  const supabase = await createSupabaseClient();
  // tenant_id was omitted, leaning on the AFM default from migration 013. It
  // works only while every login resolves to AFM; a Nest-tenant login would
  // have the insert refused outright by the restrictive tenant floor.
  const tenantId = await currentTenantId();

  const { error } = await supabase
    .from("client_members")
    .insert({ tenant_id: tenantId, client_id: clientId, user_id: userId });

  if (error) {
    log.error("clients.members", "attach_failed", {
      code: error.code ?? "unknown",
    });
    return { ok: false, error: dbError(error) };
  }

  revalidatePath(`/${locale}/clients/${clientSlug}`);
  revalidatePath(`/clients/${clientSlug}`);
  return { ok: true };
}

export async function detachClientMemberAction(
  formData: FormData,
): Promise<MemberLinkResult> {
  const clientId = (formData.get("clientId") ?? "").toString();
  const clientSlug = (formData.get("clientSlug") ?? "").toString();
  const userId = (formData.get("userId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!clientId || !userId) return { ok: false, error: "dbMissingField" };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("client_members")
    .delete()
    .eq("client_id", clientId)
    .eq("user_id", userId);

  if (error) {
    log.error("clients.members", "detach_failed", {
      code: error.code ?? "unknown",
    });
    return { ok: false, error: dbError(error) };
  }

  revalidatePath(`/${locale}/clients/${clientSlug}`);
  revalidatePath(`/clients/${clientSlug}`);
  return { ok: true };
}
