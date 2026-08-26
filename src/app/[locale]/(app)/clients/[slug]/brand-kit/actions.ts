"use server";

import { dbError } from "@/lib/db-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import type { BrandColor, BrandTypography } from "@/types/database";
import {
  buildAssetPath,
  detectAssetKind,
  validateAssetFile,
} from "@/lib/brand-assets";

export type BrandKitFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "palette", string>>;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function parseLines(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parsePalette(raw: string | null): BrandColor[] | { error: string } {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "invalidJson" };
  }
  if (!Array.isArray(parsed)) return { error: "invalidShape" };
  const result: BrandColor[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") return { error: "invalidShape" };
    const { name, hex } = item as Record<string, unknown>;
    if (typeof name !== "string" || typeof hex !== "string") {
      return { error: "invalidShape" };
    }
    const trimmedName = name.trim();
    if (!trimmedName) continue; // skip empty rows
    if (!HEX.test(hex)) return { error: "invalidHex" };
    result.push({ name: trimmedName, hex: hex.toLowerCase() });
  }
  return result;
}

function parseTypography(raw: string | null): BrandTypography {
  if (!raw) return { headings: "", body: "" };
  try {
    const parsed = JSON.parse(raw);
    return {
      headings: typeof parsed.headings === "string" ? parsed.headings : "",
      body: typeof parsed.body === "string" ? parsed.body : "",
    };
  } catch {
    return { headings: "", body: "" };
  }
}

function localePath(locale: string, path: string): Route {
  return (locale === "pt-BR" ? path : `/${locale}${path}`) as Route;
}

export async function upsertBrandKitAction(
  _prev: BrandKitFormState,
  formData: FormData,
): Promise<BrandKitFormState> {
  const clientId = (formData.get("clientId") ?? "").toString();
  const clientSlug = (formData.get("clientSlug") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const name = (formData.get("name") ?? "").toString().trim();
  const voiceTone = (formData.get("voice_tone") ?? "").toString().trim();
  const guidelinesUrl =
    (formData.get("guidelines_url") ?? "").toString().trim() || null;

  if (!clientId || !clientSlug) {
    return { error: "Missing client reference." };
  }
  if (name.length < 2) {
    return { fieldErrors: { name: "tooShort" } };
  }

  const paletteResult = parsePalette(formData.get("palette")?.toString() ?? "");
  if (!Array.isArray(paletteResult)) {
    return { fieldErrors: { palette: paletteResult.error } };
  }

  const typography = parseTypography(formData.get("typography")?.toString() ?? "");
  const doList = parseLines(formData.get("do_list")?.toString() ?? "");
  const dontList = parseLines(formData.get("dont_list")?.toString() ?? "");

  const supabase = await createSupabaseClient();

  const { error } = await supabase.from("brand_kits").upsert(
    {
      client_id: clientId,
      name,
      palette: paletteResult,
      typography,
      voice_tone: voiceTone || null,
      do_list: doList,
      dont_list: dontList,
      guidelines_url: guidelinesUrl,
    },
    { onConflict: "client_id" },
  );

  if (error) return { error: dbError(error) };

  revalidatePath(`/${locale}/clients/${clientSlug}`);
  revalidatePath(`/${locale}/clients/${clientSlug}/brand-kit`);
  redirect(localePath(locale, `/clients/${clientSlug}`));
}

// ───────────────────────────────────────────────────────────────────────────
// Asset upload / delete (Brand Kit Phase B)
// ───────────────────────────────────────────────────────────────────────────

async function ensureBrandKit(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  clientId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("brand_kits")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return null;

  const tenantId = await currentTenantId();
  const { data: created } = await supabase
    .from("brand_kits")
    .insert({ tenant_id: tenantId, client_id: clientId, name: client.name })
    .select("id")
    .single();
  return created?.id ?? null;
}

export async function uploadBrandAssetAction(formData: FormData): Promise<void> {
  const clientId = (formData.get("clientId") ?? "").toString();
  const clientSlug = (formData.get("clientSlug") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const file = formData.get("file");

  if (!clientId || !clientSlug || !(file instanceof File)) return;

  const validation = validateAssetFile({ size: file.size, type: file.type });
  if (!validation.ok) return;

  const supabase = await createSupabaseClient();
  const kitId = await ensureBrandKit(supabase, clientId);
  if (!kitId) return;

  const path = buildAssetPath(kitId, file.name || "asset");
  const { error: uploadError } = await supabase.storage
    .from("brand-assets")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return;

  const assetTenantId = await currentTenantId();
  const { error: insertError } = await supabase.from("brand_assets").insert({
    tenant_id: assetTenantId,
    brand_kit_id: kitId,
    kind: detectAssetKind(file.name, file.type),
    label: file.name || null,
    storage_path: path,
    mime_type: file.type || null,
  });
  if (insertError) {
    // Best-effort cleanup so the bucket doesn't collect orphans.
    await supabase.storage.from("brand-assets").remove([path]);
    return;
  }

  revalidatePath(`/${locale}/clients/${clientSlug}`);
  revalidatePath(`/${locale}/clients/${clientSlug}/brand-kit`);
}

export async function deleteBrandAssetAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const clientSlug = (formData.get("clientSlug") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id) return;

  const supabase = await createSupabaseClient();
  const { data: asset } = await supabase
    .from("brand_assets")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (asset?.storage_path) {
    await supabase.storage.from("brand-assets").remove([asset.storage_path]);
  }
  await supabase.from("brand_assets").delete().eq("id", id);

  revalidatePath(`/${locale}/clients/${clientSlug}/brand-kit`);
  revalidatePath(`/${locale}/clients/${clientSlug}`);
}
