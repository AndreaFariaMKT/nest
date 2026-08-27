"use server";

import { revalidatePath } from "next/cache";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { cleanText } from "@/lib/sanitize";
import { validateDocument } from "@/lib/company-documents";
import type { TablesInsert } from "@/types/database";
import { log } from "@/lib/log";

export type DocumentState = { ok: boolean; error?: string };

function read(formData: FormData, key: string, max = 500): string {
  return cleanText((formData.get(key) ?? "").toString(), { maxLength: max });
}

/**
 * Create or update one of the studio's own documents.
 *
 * One action for both, because the form is the same form and the only
 * difference is whether an id came with it — splitting them would mean two
 * copies of the validation call and, eventually, two sets of rules.
 */
export async function saveCompanyDocumentAction(
  _prev: DocumentState,
  formData: FormData,
): Promise<DocumentState> {
  const id = (formData.get("id") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();

  const verdict = validateDocument({
    title: read(formData, "title", 200),
    category: (formData.get("category") ?? "").toString(),
    document_url: read(formData, "document_url", 2000),
    valid_until: (formData.get("valid_until") ?? "").toString(),
    notes: read(formData, "notes", 2000),
  });
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  // `.select()` on both paths. PostgREST reports a write that matched no row
  // as success, so this is the only thing that tells an RLS refusal — which is
  // what a non-founder gets here — from a save that worked.
  const row: TablesInsert<"company_documents"> = {
    ...verdict.value,
    tenant_id: tenantId,
  };
  const { data, error } = id
    ? await supabase
        .from("company_documents")
        .update(row)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("company_documents")
        .insert(row)
        .select("id")
        .maybeSingle();

  if (error) {
    log.error("administration.document", "write_failed", {
      code: error.code ?? "unknown",
    });
    return { ok: false, error: "failed" };
  }
  if (!data) return { ok: false, error: "notAllowed" };

  revalidatePath(`/${locale}/administration`);
  return { ok: true };
}

/**
 * Remove one. Deliberately a hard delete rather than an archive flag: this
 * table holds a handful of rows the studio curates by hand, and a soft-delete
 * column here would be one more state for a screen that exists to be simple.
 */
export async function deleteCompanyDocumentAction(
  _prev: DocumentState,
  formData: FormData,
): Promise<DocumentState> {
  const id = (formData.get("id") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id) return { ok: false, error: "notFound" };

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const { data, error } = await supabase
    .from("company_documents")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id")
    .maybeSingle();

  if (error) {
    log.error("administration.document", "delete_failed", {
      code: error.code ?? "unknown",
    });
    return { ok: false, error: "failed" };
  }
  if (!data) return { ok: false, error: "notAllowed" };

  revalidatePath(`/${locale}/administration`);
  return { ok: true };
}
