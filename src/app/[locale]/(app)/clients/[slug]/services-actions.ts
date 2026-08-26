"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { dbError } from "@/lib/db-error";
import { log } from "@/lib/log";

/**
 * Attaching and detaching a service used to be two `Promise<void>` actions
 * with no error check at all. Under RLS a refused write is indistinguishable
 * from a successful one: the row simply does not appear, and nothing explains
 * why.
 */
export type ServiceLinkResult = { ok: boolean; error?: string };

export async function attachClientServiceAction(
  formData: FormData,
): Promise<ServiceLinkResult> {
  const clientId = (formData.get("clientId") ?? "").toString();
  const clientSlug = (formData.get("clientSlug") ?? "").toString();
  const serviceId = (formData.get("serviceId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!clientId || !serviceId) return { ok: false, error: "dbMissingField" };

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();
  const today = new Date().toISOString().slice(0, 10);

  // The primary key is (client_id, service_id, started_on), so detaching a
  // service and attaching it again the same day collided with the row just
  // ended — and that error went nowhere, so the service simply failed to
  // reappear. Reviving the row is what the person meant anyway: same service,
  // same client, same day, no longer ended.
  const { data: revived, error: reviveError } = await supabase
    .from("client_services")
    .update({ ended_on: null })
    .eq("client_id", clientId)
    .eq("service_id", serviceId)
    .eq("started_on", today)
    .select("service_id");

  if (reviveError) {
    log.error("clients.services", "revive_failed", {
      code: reviveError.code ?? "unknown",
    });
    return { ok: false, error: dbError(reviveError) };
  }

  if (!revived?.length) {
    const { error } = await supabase.from("client_services").insert({
      tenant_id: tenantId,
      client_id: clientId,
      service_id: serviceId,
      started_on: today,
    });
    if (error) {
      log.error("clients.services", "attach_failed", {
        code: error.code ?? "unknown",
      });
      return { ok: false, error: dbError(error) };
    }
  }

  revalidatePath(`/${locale}/clients/${clientSlug}`);
  revalidatePath(`/clients/${clientSlug}`);
  return { ok: true };
}

export async function detachClientServiceAction(
  formData: FormData,
): Promise<ServiceLinkResult> {
  const clientId = (formData.get("clientId") ?? "").toString();
  const clientSlug = (formData.get("clientSlug") ?? "").toString();
  const serviceId = (formData.get("serviceId") ?? "").toString();
  const startedOn = (formData.get("startedOn") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!clientId || !serviceId || !startedOn) {
    return { ok: false, error: "dbMissingField" };
  }

  const supabase = await createSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("client_services")
    .update({ ended_on: today })
    .eq("client_id", clientId)
    .eq("service_id", serviceId)
    .eq("started_on", startedOn)
    .select("service_id");

  if (error) {
    log.error("clients.services", "detach_failed", {
      code: error.code ?? "unknown",
    });
    return { ok: false, error: dbError(error) };
  }
  // PostgREST answers an UPDATE that matched no row with no error, so a write
  // RLS refused looks exactly like one that worked.
  if (!data?.length) return { ok: false, error: "dbDenied" };

  revalidatePath(`/${locale}/clients/${clientSlug}`);
  revalidatePath(`/clients/${clientSlug}`);
  return { ok: true };
}
