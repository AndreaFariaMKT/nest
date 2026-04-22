"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { parseBrlToCents } from "@/lib/money";

export type ContractFormState = {
  error?: string;
  fieldErrors?: Partial<
    Record<"title" | "starts_on" | "monthly_value" | "ends_on", string>
  >;
};

function localePath(locale: string, path: string): Route {
  return (locale === "pt-BR" ? path : `/${locale}${path}`) as Route;
}

function parseBool(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function parseDate(value: FormDataEntryValue | null): string | null {
  const s = (value ?? "").toString().trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function readForm(formData: FormData) {
  const title = (formData.get("title") ?? "").toString().trim();
  const monthlyRaw = (formData.get("monthly_value") ?? "").toString().trim();
  const startsOn = parseDate(formData.get("starts_on"));
  const endsOn = parseDate(formData.get("ends_on"));
  const autoRenew = parseBool(formData.get("auto_renew"));
  const documentUrl =
    (formData.get("document_url") ?? "").toString().trim() || null;
  const notes = (formData.get("notes") ?? "").toString().trim() || null;
  const clientId = (formData.get("clientId") ?? "").toString();
  const clientSlug = (formData.get("clientSlug") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();

  return {
    title,
    monthlyRaw,
    startsOn,
    endsOn,
    autoRenew,
    documentUrl,
    notes,
    clientId,
    clientSlug,
    locale,
  };
}

function validate(
  form: ReturnType<typeof readForm>,
): ContractFormState | { ok: true; monthlyCents: number | null } {
  const fieldErrors: ContractFormState["fieldErrors"] = {};
  if (form.title.length < 2) fieldErrors.title = "tooShort";
  if (!form.startsOn) fieldErrors.starts_on = "required";
  if (form.endsOn && form.startsOn && form.endsOn < form.startsOn) {
    fieldErrors.ends_on = "beforeStart";
  }

  let monthlyCents: number | null = null;
  if (form.monthlyRaw.length > 0) {
    const parsed = parseBrlToCents(form.monthlyRaw);
    if (parsed === null) fieldErrors.monthly_value = "invalid";
    else monthlyCents = parsed;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }
  return { ok: true, monthlyCents };
}

export async function createContractAction(
  _prev: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const form = readForm(formData);
  const check = validate(form);
  if (!("ok" in check)) return check;

  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("contracts").insert({
    client_id: form.clientId,
    title: form.title,
    monthly_value_cents: check.monthlyCents,
    currency: "BRL",
    starts_on: form.startsOn!,
    ends_on: form.endsOn,
    auto_renew: form.autoRenew,
    document_url: form.documentUrl,
    notes: form.notes,
  });

  if (error) return { error: error.message };

  revalidatePath(`/${form.locale}/clients/${form.clientSlug}`);
  revalidatePath(`/${form.locale}/clients/${form.clientSlug}/contracts`);
  redirect(localePath(form.locale, `/clients/${form.clientSlug}/contracts`));
}

export async function updateContractAction(
  _prev: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const id = (formData.get("id") ?? "").toString();
  if (!id) return { error: "Missing contract id." };

  const form = readForm(formData);
  const check = validate(form);
  if (!("ok" in check)) return check;

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("contracts")
    .update({
      title: form.title,
      monthly_value_cents: check.monthlyCents,
      currency: "BRL",
      starts_on: form.startsOn!,
      ends_on: form.endsOn,
      auto_renew: form.autoRenew,
      document_url: form.documentUrl,
      notes: form.notes,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/${form.locale}/clients/${form.clientSlug}`);
  revalidatePath(`/${form.locale}/clients/${form.clientSlug}/contracts`);
  redirect(localePath(form.locale, `/clients/${form.clientSlug}/contracts`));
}

export async function deleteContractAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const clientSlug = (formData.get("clientSlug") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id) return;

  const supabase = await createSupabaseClient();
  await supabase.from("contracts").delete().eq("id", id);

  revalidatePath(`/${locale}/clients/${clientSlug}`);
  revalidatePath(`/${locale}/clients/${clientSlug}/contracts`);
}
