"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";

export async function attachClientServiceAction(
  formData: FormData,
): Promise<void> {
  const clientId = (formData.get("clientId") ?? "").toString();
  const clientSlug = (formData.get("clientSlug") ?? "").toString();
  const serviceId = (formData.get("serviceId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!clientId || !serviceId) return;

  const supabase = await createSupabaseClient();
  await supabase.from("client_services").insert({
    client_id: clientId,
    service_id: serviceId,
    started_on: new Date().toISOString().slice(0, 10),
  });

  revalidatePath(`/${locale}/clients/${clientSlug}`);
}

export async function detachClientServiceAction(
  formData: FormData,
): Promise<void> {
  const clientId = (formData.get("clientId") ?? "").toString();
  const clientSlug = (formData.get("clientSlug") ?? "").toString();
  const serviceId = (formData.get("serviceId") ?? "").toString();
  const startedOn = (formData.get("startedOn") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!clientId || !serviceId || !startedOn) return;

  const supabase = await createSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from("client_services")
    .update({ ended_on: today })
    .eq("client_id", clientId)
    .eq("service_id", serviceId)
    .eq("started_on", startedOn);

  revalidatePath(`/${locale}/clients/${clientSlug}`);
}
