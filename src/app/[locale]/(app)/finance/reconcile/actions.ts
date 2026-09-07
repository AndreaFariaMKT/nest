"use server";

import { revalidatePath } from "next/cache";

import { dbError } from "@/lib/db-error";
import { log } from "@/lib/log";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { getCurrentProfile } from "@/lib/auth";
import { parseStatement } from "@/lib/bank-parse";
import { dropAlreadyImported, reconcile, type Expected } from "@/lib/reconcile";

export type ImportState = {
  error?: string;
  imported?: number;
  skipped?: number;
  unreadable?: number;
};

const MAX_BYTES = 4 * 1024 * 1024;

export async function importStatementAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const accountId = (formData.get("account_id") ?? "").toString() || null;
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "noFile" };
  }
  // A statement is a few hundred kilobytes. The cap is here so a mistaken
  // upload fails fast rather than being parsed line by line first.
  if (file.size > MAX_BYTES) return { error: "tooLarge" };

  const text = await file.text();
  const parsed = parseStatement(file.name, text);
  if (parsed.lines.length === 0) {
    return { error: "noLines", unreadable: parsed.skipped };
  }

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();
  const profile = await getCurrentProfile();

  // Already-staged references, so pulling the month twice does not double it.
  const { data: knownLines } = await supabase.from("fin_import_lines")
    .select("external_ref")
    .eq("tenant_id", tenantId)
    .not("external_ref", "is", null);
  const knownRefs = new Set(
    ((knownLines ?? []) as Array<{ external_ref: string }>).map(
      (l) => l.external_ref,
    ),
  );
  const { fresh, skipped } = dropAlreadyImported(parsed.lines, knownRefs);

  if (fresh.length === 0) {
    return { imported: 0, skipped, unreadable: parsed.skipped };
  }

  // What the studio was expecting: everything still open, on both sides.
  const [{ data: receivables }, { data: payables }] = await Promise.all([
    supabase.from("fin_receivables")
      .select("id, amount_cents, due_on, description, client_id, status, paid_on")
      .eq("tenant_id", tenantId)
      .is("paid_on", null)
      .neq("status", "cancelled"),
    supabase.from("fin_payables")
      .select("id, amount_cents, due_on, description, supplier_id, status, paid_on")
      .eq("tenant_id", tenantId)
      .is("paid_on", null)
      .neq("status", "cancelled"),
  ]);

  const [{ data: clients }, { data: suppliers }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("tenant_id", tenantId),
    supabase.from("fin_suppliers").select("id, name").eq("tenant_id", tenantId),
  ]);
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const supplierName = new Map(
    ((suppliers ?? []) as Array<{ id: string; name: string }>).map((s) => [
      s.id,
      s.name,
    ]),
  );

  const expected: Expected[] = [
    ...((receivables ?? []) as Array<{
      id: string;
      amount_cents: number;
      due_on: string;
      description: string;
      client_id: string | null;
    }>).map((r) => ({
      id: r.id,
      kind: "receivable" as const,
      amount_cents: r.amount_cents,
      date: r.due_on,
      counterparty: r.client_id ? clientName.get(r.client_id) ?? null : null,
      description: r.description,
    })),
    ...((payables ?? []) as Array<{
      id: string;
      amount_cents: number;
      due_on: string;
      description: string;
      supplier_id: string | null;
    }>).map((p) => ({
      id: p.id,
      kind: "payable" as const,
      // Payables are recorded as a positive obligation; a bank line for one is
      // negative. Flipping here rather than in the matcher keeps the matcher
      // about matching.
      amount_cents: -Math.abs(p.amount_cents),
      date: p.due_on,
      counterparty: p.supplier_id
        ? supplierName.get(p.supplier_id) ?? null
        : null,
      description: p.description,
    })),
  ];

  const matches = reconcile(fresh, expected);

  const { data: importRow, error: importError } = await supabase.from("fin_imports")
    .insert({
      tenant_id: tenantId,
      account_id: accountId,
      filename: file.name,
      format: file.name.toLowerCase().endsWith(".csv") ? "csv" : "ofx",
      period_start: fresh.reduce((a, l) => (l.date < a ? l.date : a), fresh[0].date),
      period_end: fresh.reduce((a, l) => (l.date > a ? l.date : a), fresh[0].date),
      line_count: fresh.length,
      imported_by: profile?.id ?? null,
    })
    .select("id")
    .single();

  if (importError || !importRow) {
    log.error("finance.import", "import_failed", { code: importError?.code });
    return { error: dbError(importError) };
  }

  const { error: linesError } = await supabase.from("fin_import_lines")
    .insert(
      matches.map((m) => ({
        tenant_id: tenantId,
        import_id: importRow.id,
        external_ref: m.line.external_ref,
        date: m.line.date,
        description: m.line.description,
        amount_cents: m.line.amount_cents,
        match_kind: m.kind,
        match_reasons: m.reasons,
        matched_kind: m.expected?.kind ?? null,
        matched_id: m.expected?.id ?? null,
      })),
    );

  if (linesError) {
    log.error("finance.import", "lines_failed", { code: linesError.code });
    return { error: dbError(linesError) };
  }

  revalidatePath(`/${locale}/finance/reconcile`);
  return { imported: fresh.length, skipped, unreadable: parsed.skipped };
}

/**
 * Confirm one staged line into the ledger.
 *
 * This is the only path from a bank file to fin_entries, and it runs one line
 * at a time because a person agreed to that line. There is deliberately no
 * "confirm everything" for suggestions — only for the `auto` ones, below,
 * where the matcher already proved amount, date and counterparty agree.
 */
export async function confirmLineAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const categoryId = (formData.get("category_id") ?? "").toString() || null;
  const accountId = (formData.get("account_id") ?? "").toString() || null;
  if (!id) return;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const { data: line } = await supabase.from("fin_import_lines")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!line || line.confirmed_at) return;

  const { data: entry, error } = await supabase.from("fin_entries")
    .insert({
      tenant_id: tenantId,
      account_id: accountId,
      category_id: categoryId,
      description: line.description,
      amount_cents: line.amount_cents,
      currency: "BRL",
      date_cash: line.date,
      // Competência defaults to the cash date and is corrected on the entry
      // itself. Guessing it from a matched receivable would be right more
      // often than not, and wrong silently the rest of the time.
      date_accrual: line.date,
      reconciled: true,
      external_ref: line.external_ref,
    })
    .select("id")
    .single();

  if (error || !entry) {
    log.error("finance.reconcile", "entry_failed", { code: error?.code });
    return;
  }

  await supabase.from("fin_import_lines")
    .update({ confirmed_at: new Date().toISOString(), entry_id: entry.id })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  // Close the thing it matched, when it matched one.
  if (line.matched_id && line.matched_kind === "receivable") {
    await supabase.from("fin_receivables")
      .update({ paid_on: line.date, status: "paid" })
      .eq("id", line.matched_id)
      .eq("tenant_id", tenantId);
  } else if (line.matched_id && line.matched_kind === "payable") {
    await supabase.from("fin_payables")
      .update({ paid_on: line.date, status: "paid" })
      .eq("id", line.matched_id)
      .eq("tenant_id", tenantId);
  }

  revalidatePath(`/${locale}/finance/reconcile`);
  revalidatePath(`/${locale}/finance`);
}

export async function discardLineAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id) return;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  // Staged only: a discarded line never became an entry, so there is nothing
  // in the ledger to undo.
  await supabase.from("fin_import_lines")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("confirmed_at", null);

  revalidatePath(`/${locale}/finance/reconcile`);
}
