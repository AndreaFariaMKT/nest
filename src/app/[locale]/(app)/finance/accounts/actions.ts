"use server";

import { revalidatePath } from "next/cache";

import { dbError } from "@/lib/db-error";
import { log } from "@/lib/log";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { parseRate } from "@/lib/finance-entry";

export type AccountFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name", string>>;
};

export type RateFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"rate" | "day", string>>;
};

function optional(formData: FormData, key: string) {
  const v = (formData.get(key) ?? "").toString().trim();
  return v.length > 0 ? v : null;
}

const CURRENCIES = new Set(["BRL", "USD"]);
const KINDS = new Set(["operacional", "reserva"]);

export async function saveAccountAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const id = optional(formData, "id");
  const name = (formData.get("name") ?? "").toString().trim();
  const locale = (formData.get("locale") ?? "pt-BR").toString();

  if (name.length < 2) return { fieldErrors: { name: "tooShort" } };

  const currency = (formData.get("currency") ?? "BRL").toString();
  const kind = (formData.get("kind") ?? "operacional").toString();
  // The column's CHECK would refuse these anyway, but a constraint violation
  // reaches the person as a SQLSTATE. Falling back to the safe value keeps a
  // tampered select from being the thing that breaks a save.
  const payload = {
    name,
    institution: optional(formData, "institution"),
    currency: CURRENCIES.has(currency) ? currency : "BRL",
    kind: KINDS.has(kind) ? kind : "operacional",
  };

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const { error } = id
    ? await supabase.from("fin_accounts")
        .update(payload)
        .eq("id", id)
        .eq("tenant_id", tenantId)
    : await supabase.from("fin_accounts")
        .insert({ ...payload, tenant_id: tenantId });

  if (error) {
    log.error("finance.accounts", id ? "update_failed" : "insert_failed", {
      code: error.code,
    });
    return { error: dbError(error) };
  }

  revalidatePath(`/${locale}/finance/accounts`);
  revalidatePath(`/${locale}/finance`);
  return {};
}

/**
 * Accounts are archived, never deleted.
 *
 * `fin_entries.account_id` is `on delete restrict`, so an account with a
 * single movement against it cannot be removed — and should not be: deleting
 * it would be deleting the answer to "where was this money". Archiving takes
 * it out of every picker and out of the balance panel while the history it
 * carries stays readable.
 */
export async function toggleAccountAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const active = (formData.get("active") ?? "").toString() === "true";
  if (!id) return;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const { error } = await supabase.from("fin_accounts")
    .update({ is_active: active })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) log.error("finance.accounts", "toggle_failed", { code: error.code });

  revalidatePath(`/${locale}/finance/accounts`);
  revalidatePath(`/${locale}/finance`);
}

/**
 * One day's USD→BRL rate.
 *
 * Upsert rather than insert: 049 has a unique key on (tenant, day, base,
 * quote), so correcting a rate typed wrong has to overwrite the row. An insert
 * would fail on the duplicate and leave the wrong number in place, which is
 * the worst of the three outcomes.
 */
export async function saveRateAction(
  _prev: RateFormState,
  formData: FormData,
): Promise<RateFormState> {
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const day = (formData.get("day") ?? "").toString().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { fieldErrors: { day: "invalid" } };
  }

  const rate = parseRate((formData.get("rate") ?? "").toString());
  if (rate === null) return { fieldErrors: { rate: "invalid" } };

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const { error } = await supabase.from("fin_fx_rates").upsert(
    {
      tenant_id: tenantId,
      day,
      base: "USD",
      quote: "BRL",
      rate,
      source: "manual",
    },
    { onConflict: "tenant_id,day,base,quote" },
  );

  if (error) {
    log.error("finance.rates", "upsert_failed", { code: error.code });
    return { error: dbError(error) };
  }

  revalidatePath(`/${locale}/finance/accounts`);
  revalidatePath(`/${locale}/finance`);
  return {};
}

export async function deleteRateAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id) return;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  // Entries store their own converted amount at the time they were written
  // (amount_brl_cents, 054), so removing a rate never rewrites history — it
  // only changes what future conversions and open-total figures use.
  const { error } = await supabase.from("fin_fx_rates")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) log.error("finance.rates", "delete_failed", { code: error.code });

  revalidatePath(`/${locale}/finance/accounts`);
  revalidatePath(`/${locale}/finance`);
}
