"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";

export type CreateClientState = {
  error?: string;
  fieldErrors?: Partial<Record<"name", string>>;
};

export async function createClientAction(
  _prev: CreateClientState,
  formData: FormData,
): Promise<CreateClientState> {
  const name = (formData.get("name") ?? "").toString().trim();
  const industry = (formData.get("industry") ?? "").toString().trim();
  const website = (formData.get("website") ?? "").toString().trim();
  const notes = (formData.get("notes") ?? "").toString().trim();
  const locale = (formData.get("locale") ?? "pt-BR").toString();

  if (name.length < 2) {
    return { fieldErrors: { name: "tooShort" } };
  }

  const baseSlug = slugify(name) || "client";

  const supabase = await createSupabaseClient();

  // Resolve a unique slug by appending -2, -3… on collision
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  const { error } = await supabase.from("clients").insert({
    name,
    slug,
    industry: industry || null,
    website: website || null,
    notes: notes || null,
    status: "active",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/${locale}/clients`);
  redirect(`/${locale === "pt-BR" ? "" : locale + "/"}clients`);
}
