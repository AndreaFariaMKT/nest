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
  /** Key under finance.reconcile.errors. */
  error?: string;
  imported?: number;
  skipped?: number;
  unreadable?: number;
};

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * A statement is tens to hundreds of lines. Four megabytes of CSV is on the
 * order of 10^5 rows, and every one of them would be parsed into memory and
 * written as a single insert — so the byte cap alone does not bound the work.
 */
const MAX_LINES = 2000;

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
  if (parsed.lines.length > MAX_LINES) {
    return { error: "tooManyLines" };
  }

  // The bank's own reference is only unique per file for well-behaved
  // exporters. A file that repeats a FITID would collide on
  // fin_import_lines_ref_key and fail the whole batch insert, so the duplicate
  // is dropped here with the same reasoning as dropAlreadyImported: the second
  // occurrence is the same movement.
  const seen = new Set<string>();
  const deduped = parsed.lines.filter((l) => {
    if (!l.external_ref) return true;
    if (seen.has(l.external_ref)) return false;
    seen.add(l.external_ref);
    return true;
  });

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
  const { fresh, skipped } = dropAlreadyImported(deduped, knownRefs);

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
    .select("*, import:fin_imports(account_id)")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!line || line.confirmed_at) return;

  // The import already knows which account the statement came from. The form
  // is an override, not the source: its select defaults to "—", so confirming
  // without touching it wrote account_id = null, and a null-account entry is
  // skipped by the balance sum entirely — a month reconciled that way left
  // every balance at zero while the entries still counted in the month totals.
  const importedAccount =
    (line as { import?: { account_id: string | null } | null }).import
      ?.account_id ?? null;
  const resolvedAccount = accountId ?? importedAccount;

  // The currency of the account the money moved through, not a constant. This
  // was hardcoded "BRL", so importing a Wise statement turned every dollar into
  // a real before anything downstream had a chance to convert it.
  const { data: account } = resolvedAccount
    ? await supabase
        .from("fin_accounts")
        .select("currency")
        .eq("id", resolvedAccount)
        .eq("tenant_id", tenantId)
        .maybeSingle()
    : { data: null };
  const currency = account?.currency ?? "BRL";

  // The month this belongs to comes from the obligation it settles, when it
  // settles one. August's retainer paid on 5 September is September's cash and
  // August's revenue — writing the cash date into both is precisely the
  // conflation the two-date model exists to prevent, and it moved R$ 4.000 of
  // revenue into the wrong month.
  let accrual = line.date;
  if (line.matched_id && line.matched_kind === "receivable") {
    const { data } = await supabase
      .from("fin_receivables")
      .select("date_accrual")
      .eq("id", line.matched_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    accrual = data?.date_accrual ?? line.date;
  } else if (line.matched_id && line.matched_kind === "payable") {
    const { data } = await supabase
      .from("fin_payables")
      .select("date_accrual")
      .eq("id", line.matched_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    accrual = data?.date_accrual ?? line.date;
  }

  // Converted at the movement's own date. A rate looked up later is a
  // different number — the studio is not owed today's rate on August's money.
  const { data: rateRows } = await supabase
    .from("fin_fx_rates")
    .select("day, base, quote, rate")
    .eq("tenant_id", tenantId)
    .lte("day", line.date)
    .order("day", { ascending: false })
    .limit(1);

  const rate = rateRows?.[0] ? Number(rateRows[0].rate) : null;
  const amountBrl =
    currency === "BRL"
      ? line.amount_cents
      : rate === null
        ? null
        : Math.round(line.amount_cents * rate);

  const { data: entry, error } = await supabase.from("fin_entries")
    .insert({
      tenant_id: tenantId,
      account_id: resolvedAccount,
      category_id: categoryId,
      description: line.description,
      amount_cents: line.amount_cents,
      amount_brl_cents: amountBrl,
      currency,
      date_cash: line.date,
      date_accrual: accrual,
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
