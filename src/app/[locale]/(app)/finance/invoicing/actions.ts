"use server";

import { revalidatePath } from "next/cache";

import { log } from "@/lib/log";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { fin } from "@/lib/finance-db";

/**
 * Move a receivable along the nota fiscal track.
 *
 * Only forward, and only through the two states a person actually performs:
 * `requested` when the accountant has been asked, `issued` when the nota
 * exists. `export` is decided by the client's country and never set by hand —
 * a person clicking "this is an export" on a Brazilian client is the mistake
 * the country field exists to prevent.
 */
export async function setInvoiceStatusAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const next = (formData.get("status") ?? "").toString();
  const ref = (formData.get("invoice_ref") ?? "").toString().trim() || null;

  if (!id || (next !== "requested" && next !== "issued")) return;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const { error } = await fin(supabase)
    .from("fin_receivables")
    .update({ invoice_status: next, invoice_ref: ref })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    log.error("finance.invoicing", "status_failed", { code: error.code });
  }

  revalidatePath(`/${locale}/finance/invoicing`);
  revalidatePath(`/${locale}/finance`);
}
