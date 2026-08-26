"use server";

import { dbError } from "@/lib/db-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { parseBrlToCents } from "@/lib/money";
import { slugify } from "@/lib/slug";

export type ServiceFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "default_monthly", string>>;
};

function localePath(locale: string, path: string): Route {
  return (locale === "pt-BR" ? path : `/${locale}${path}`) as Route;
}

function read(formData: FormData) {
  return {
    name: (formData.get("name") ?? "").toString().trim(),
    description:
      (formData.get("description") ?? "").toString().trim() || null,
    monthlyRaw: (formData.get("default_monthly") ?? "").toString().trim(),
    locale: (formData.get("locale") ?? "pt-BR").toString(),
  };
}

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  baseSlug: string,
  excludeId?: string,
): Promise<string> {
  let slug = baseSlug || "service";
  let suffix = 2;
  while (true) {
    let query = supabase.from("services").select("id").eq("slug", slug).limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug || "service"}-${suffix++}`;
  }
}

function resolveMonthly(
  raw: string,
): number | null | { error: "default_monthly" } {
  if (raw.length === 0) return null;
  const cents = parseBrlToCents(raw);
  if (cents === null) return { error: "default_monthly" };
  return cents;
}

export async function createServiceAction(
  _prev: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const form = read(formData);
  if (form.name.length < 2) return { fieldErrors: { name: "tooShort" } };

  const monthly = resolveMonthly(form.monthlyRaw);
  if (monthly && typeof monthly === "object" && "error" in monthly) {
    return { fieldErrors: { default_monthly: "invalid" } };
  }

  const supabase = await createSupabaseClient();
  const slug = await uniqueSlug(supabase, slugify(form.name));
  const tenantId = await currentTenantId();

  const { error } = await supabase.from("services").insert({
    tenant_id: tenantId,
    name: form.name,
    slug,
    description: form.description,
    default_monthly_cents: monthly as number | null,
  });
  if (error) return { error: dbError(error) };

  revalidatePath(`/${form.locale}/services`);
  redirect(localePath(form.locale, "/services"));
}

export async function updateServiceAction(
  _prev: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const id = (formData.get("id") ?? "").toString();
  if (!id) return { error: "Missing service id." };

  const form = read(formData);
  if (form.name.length < 2) return { fieldErrors: { name: "tooShort" } };

  const monthly = resolveMonthly(form.monthlyRaw);
  if (monthly && typeof monthly === "object" && "error" in monthly) {
    return { fieldErrors: { default_monthly: "invalid" } };
  }

  const supabase = await createSupabaseClient();
  const { data: current } = await supabase
    .from("services")
    .select("name, slug")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { error: "Service not found." };

  const slug =
    current.name === form.name
      ? current.slug
      : await uniqueSlug(supabase, slugify(form.name), id);

  const { error } = await supabase
    .from("services")
    .update({
      name: form.name,
      slug,
      description: form.description,
      default_monthly_cents: monthly as number | null,
    })
    .eq("id", id);
  if (error) return { error: dbError(error) };

  revalidatePath(`/${form.locale}/services`);
  redirect(localePath(form.locale, "/services"));
}

export async function deleteServiceAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id) return;

  const supabase = await createSupabaseClient();
  await supabase.from("services").delete().eq("id", id);

  revalidatePath(`/${locale}/services`);
}
