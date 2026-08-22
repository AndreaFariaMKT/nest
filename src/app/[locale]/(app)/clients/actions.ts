"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { slugify } from "@/lib/slug";

export type ClientStatus = "prospect" | "active" | "paused" | "archived";

export type ClientFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "posts_per_cycle", string>>;
};

function localePath(locale: string, path: string): Route {
  return (locale === "pt-BR" ? path : `/${locale}${path}`) as Route;
}

function parseName(formData: FormData) {
  return (formData.get("name") ?? "").toString().trim();
}

function parseOptional(formData: FormData, key: string) {
  const value = (formData.get(key) ?? "").toString().trim();
  return value.length > 0 ? value : null;
}

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  baseSlug: string,
  excludeId?: string,
) {
  let slug = baseSlug || "client";
  let suffix = 2;
  while (true) {
    let query = supabase.from("clients").select("id").eq("slug", slug).limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug || "client"}-${suffix++}`;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Create
// ───────────────────────────────────────────────────────────────────────────

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const name = parseName(formData);
  const locale = (formData.get("locale") ?? "pt-BR").toString();

  if (name.length < 2) return { fieldErrors: { name: "tooShort" } };

  const supabase = await createSupabaseClient();
  const slug = await uniqueSlug(supabase, slugify(name));
  const tenantId = await currentTenantId();

  const { error } = await supabase.from("clients").insert({
    tenant_id: tenantId,
    name,
    slug,
    industry: parseOptional(formData, "industry"),
    website: parseOptional(formData, "website"),
    notes: parseOptional(formData, "notes"),
    status: "active",
  });

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/clients`);
  redirect(localePath(locale, `/clients/${slug}`));
}

// ───────────────────────────────────────────────────────────────────────────
// Update
// ───────────────────────────────────────────────────────────────────────────

export async function updateClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const id = (formData.get("id") ?? "").toString();
  const name = parseName(formData);
  const status = (formData.get("status") ?? "active").toString() as ClientStatus;
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  // How many publications one fortnight buys — the divisor behind the social
  // module's backlog meter, so a wrong value quietly mis-reads every shelf.
  const socialEnabled = formData.get("social_enabled") !== null;
  // An emptied <input type="number"> submits "", which is present — so `?? "2"`
  // never fires and parseInt("") is NaN. Treat blank as "leave the default"
  // rather than rejecting a save that only changed the client's name.
  const rawPerCycle = (formData.get("posts_per_cycle") ?? "").toString().trim();
  const postsPerCycle = rawPerCycle === "" ? 2 : Number.parseInt(rawPerCycle, 10);

  if (!id) return { error: "Missing client id." };
  if (name.length < 2) return { fieldErrors: { name: "tooShort" } };
  if (!Number.isFinite(postsPerCycle) || postsPerCycle < 1 || postsPerCycle > 40) {
    return { fieldErrors: { posts_per_cycle: "outOfRange" } };
  }

  const supabase = await createSupabaseClient();

  const { data: current } = await supabase
    .from("clients")
    .select("slug, name")
    .eq("id", id)
    .single();

  if (!current) return { error: "Client not found." };

  // Re-slug only when the name actually changed
  const slug =
    current.name === name
      ? current.slug
      : await uniqueSlug(supabase, slugify(name), id);

  const { error } = await supabase
    .from("clients")
    .update({
      name,
      slug,
      industry: parseOptional(formData, "industry"),
      website: parseOptional(formData, "website"),
      notes: parseOptional(formData, "notes"),
      status,
      social_enabled: socialEnabled,
      posts_per_cycle: postsPerCycle,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/clients`);
  revalidatePath(`/${locale}/clients/${slug}`);
  revalidatePath(`/${locale}/social`);
  redirect(localePath(locale, `/clients/${slug}`));
}

// ───────────────────────────────────────────────────────────────────────────
// Archive
// ───────────────────────────────────────────────────────────────────────────

export async function archiveClientAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id) return;

  const supabase = await createSupabaseClient();
  await supabase.from("clients").update({ status: "archived" }).eq("id", id);

  revalidatePath(`/${locale}/clients`);
  redirect(localePath(locale, "/clients"));
}

// ───────────────────────────────────────────────────────────────────────────
// Portal token — mint / rotate a token for /p/[token] read-only access
// ───────────────────────────────────────────────────────────────────────────

function generatePortalToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generatePortalTokenAction(
  formData: FormData,
): Promise<void> {
  const clientId = (formData.get("clientId") ?? "").toString();
  const slug = (formData.get("slug") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!clientId || !slug) return;

  const token = generatePortalToken();
  const supabase = await createSupabaseClient();
  await supabase
    .from("clients")
    .update({ portal_token: token })
    .eq("id", clientId);

  revalidatePath(`/${locale}/clients/${slug}`);
  redirect(localePath(locale, `/clients/${slug}`));
}

export async function revokePortalTokenAction(
  formData: FormData,
): Promise<void> {
  const clientId = (formData.get("clientId") ?? "").toString();
  const slug = (formData.get("slug") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!clientId || !slug) return;

  const supabase = await createSupabaseClient();
  await supabase
    .from("clients")
    .update({ portal_token: null })
    .eq("id", clientId);

  revalidatePath(`/${locale}/clients/${slug}`);
  redirect(localePath(locale, `/clients/${slug}`));
}
