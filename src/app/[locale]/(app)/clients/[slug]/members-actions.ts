"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";

export async function attachClientMemberAction(
  formData: FormData,
): Promise<void> {
  const clientId = (formData.get("clientId") ?? "").toString();
  const clientSlug = (formData.get("clientSlug") ?? "").toString();
  const userId = (formData.get("userId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!clientId || !userId) return;

  const supabase = await createSupabaseClient();
  await supabase
    .from("client_members")
    .insert({ client_id: clientId, user_id: userId });

  revalidatePath(`/${locale}/clients/${clientSlug}`);
}

export async function detachClientMemberAction(
  formData: FormData,
): Promise<void> {
  const clientId = (formData.get("clientId") ?? "").toString();
  const clientSlug = (formData.get("clientSlug") ?? "").toString();
  const userId = (formData.get("userId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!clientId || !userId) return;

  const supabase = await createSupabaseClient();
  await supabase
    .from("client_members")
    .delete()
    .eq("client_id", clientId)
    .eq("user_id", userId);

  revalidatePath(`/${locale}/clients/${clientSlug}`);
}
