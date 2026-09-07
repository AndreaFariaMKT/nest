"use server";

import { revalidatePath } from "next/cache";

import { dbError } from "@/lib/db-error";
import { log } from "@/lib/log";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { parseBrlToCents } from "@/lib/money";

export type SupplierFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "amount" | "payDay", string>>;
};

function optional(formData: FormData, key: string) {
  const v = (formData.get(key) ?? "").toString().trim();
  return v.length > 0 ? v : null;
}

export async function saveSupplierAction(
  _prev: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  const id = optional(formData, "id");
  const name = (formData.get("name") ?? "").toString().trim();
  const locale = (formData.get("locale") ?? "pt-BR").toString();

  if (name.length < 2) return { fieldErrors: { name: "tooShort" } };

  const rawAmount = optional(formData, "default_amount");
  let amountCents: number | null = null;
  if (rawAmount) {
    amountCents = parseBrlToCents(rawAmount);
    // parseBrlToCents refuses a lone dot that looks like thousands, among
    // other things — a null here is a typo, not an empty field.
    if (amountCents === null) return { fieldErrors: { amount: "invalid" } };
  }

  const rawPayDay = optional(formData, "pay_day");
  let payDay: number | null = null;
  if (rawPayDay) {
    payDay = Number(rawPayDay);
    if (!Number.isInteger(payDay) || payDay < 1 || payDay > 31) {
      return { fieldErrors: { payDay: "invalid" } };
    }
  }

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const payload = {
    name,
    category: optional(formData, "category"),
    doc_type: optional(formData, "doc_type"),
    doc_number: optional(formData, "doc_number"),
    pix_key: optional(formData, "pix_key"),
    default_amount_cents: amountCents,
    pay_day: payDay,
    note_status: (formData.get("note_status") ?? "pending").toString(),
    notes: optional(formData, "notes"),
  };

  const { error } = id
    ? await supabase.from("fin_suppliers")
        .update(payload)
        .eq("id", id)
        .eq("tenant_id", tenantId)
    : await supabase.from("fin_suppliers")
        .insert({ ...payload, tenant_id: tenantId });

  if (error) {
    log.error("finance.suppliers", id ? "update_failed" : "insert_failed", {
      code: error.code,
    });
    return { error: dbError(error) };
  }

  revalidatePath(`/${locale}/finance/suppliers`);
  return {};
}

export async function deleteSupplierAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id) return;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  // Entries and payables point here with `on delete set null`, so history
  // survives — removing a supplier removes the contact, not the record that
  // they were paid.
  const { error } = await supabase.from("fin_suppliers")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    log.error("finance.suppliers", "delete_failed", { code: error.code });
  }
  revalidatePath(`/${locale}/finance/suppliers`);
}
