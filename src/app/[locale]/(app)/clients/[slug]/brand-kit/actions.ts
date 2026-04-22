"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { BrandColor, BrandTypography } from "@/types/database";

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

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/clients/${clientSlug}`);
  revalidatePath(`/${locale}/clients/${clientSlug}/brand-kit`);
  redirect(localePath(locale, `/clients/${clientSlug}`));
}
