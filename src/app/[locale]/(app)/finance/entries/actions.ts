"use server";

import { revalidatePath } from "next/cache";

import { dbError } from "@/lib/db-error";
import { log } from "@/lib/log";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { parseBrlToCents } from "@/lib/money";
import { signedAmount, accrualFor, type Direction } from "@/lib/finance-entry";

export type EntryFormState = {
  error?: string;
  fieldErrors?: Partial<
    Record<"description" | "amount" | "date" | "account", string>
  >;
  saved?: boolean;
};

function optional(formData: FormData, key: string) {
  const v = (formData.get(key) ?? "").toString().trim();
  return v.length > 0 ? v : null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Type a movement straight into the ledger.
 *
 * Until this existed, the only way a row reached `fin_entries` was confirming
 * a line from an imported bank statement — so a studio that had not yet
 * exported an OFX had a finance module it could read and not fill in. Cash
 * paid in person, a PIX made from a phone, and the opening balance of an
 * account that existed before the system did all arrive here.
 */
export async function saveEntryAction(
  _prev: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const locale = (formData.get("locale") ?? "pt-BR").toString();

  const description = (formData.get("description") ?? "").toString().trim();
  if (description.length < 2) return { fieldErrors: { description: "tooShort" } };

  const dateCash = (formData.get("date_cash") ?? "").toString().trim();
  if (!ISO_DATE.test(dateCash)) return { fieldErrors: { date: "invalid" } };

  const typedAccrual = optional(formData, "date_accrual");
  if (typedAccrual && !ISO_DATE.test(typedAccrual)) {
    return { fieldErrors: { date: "invalid" } };
  }
  const dateAccrual = accrualFor(dateCash, typedAccrual);

  const magnitude = parseBrlToCents((formData.get("amount") ?? "").toString());
  if (magnitude === null || magnitude === 0) {
    return { fieldErrors: { amount: "invalid" } };
  }
  const direction = (
    (formData.get("direction") ?? "out").toString() === "in" ? "in" : "out"
  ) as Direction;
  const amountCents = signedAmount(direction, magnitude);

  const accountId = optional(formData, "account_id");
  // An entry with no account is invisible to every balance — fin_account_balances
  // groups by account_id, so a null-account row still counts in the month totals
  // and never appears in "onde está o dinheiro". That divergence is exactly the
  // bug the reconcile path already had to be fixed for; here it is refused up
  // front instead.
  if (!accountId) return { fieldErrors: { account: "required" } };

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const { data: account } = await supabase
    .from("fin_accounts")
    .select("currency")
    .eq("id", accountId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!account) return { fieldErrors: { account: "required" } };
  const currency = account.currency;

  // Converted at the movement's own date, never at today's. The studio is not
  // owed today's rate on August's money.
  let amountBrl: number | null = amountCents;
  if (currency !== "BRL") {
    const { data: rateRows } = await supabase
      .from("fin_fx_rates")
      .select("rate")
      .eq("tenant_id", tenantId)
      .eq("base", "USD")
      .eq("quote", "BRL")
      .lte("day", dateCash)
      .order("day", { ascending: false })
      .limit(1);
    const rate = rateRows?.[0] ? Number(rateRows[0].rate) : null;
    // Null rather than a fallback. A missing rate has to read "sem câmbio" on
    // screen; a guessed one produces a number that looks like money and is
    // wrong in the direction nobody checks.
    amountBrl = rate === null ? null : Math.round(amountCents * rate);
  }

  const { error } = await supabase.from("fin_entries").insert({
    tenant_id: tenantId,
    account_id: accountId,
    category_id: optional(formData, "category_id"),
    description,
    amount_cents: amountCents,
    amount_brl_cents: amountBrl,
    currency,
    date_cash: dateCash,
    date_accrual: dateAccrual,
    client_id: optional(formData, "client_id"),
    project_id: optional(formData, "project_id"),
    supplier_id: optional(formData, "supplier_id"),
    // `notes` is deliberately NOT written: EntryForm has no such field, so
    // this read was always null. Same reasoning as fin_suppliers — a write-only
    // key is harmless while the column is empty and a silent wipe the day
    // anything else fills it.
    // Typed by hand, so it has not been checked against a statement. The
    // reconciliation screen is what flips this, and leaving it false is what
    // lets a later import still find the line.
    reconciled: false,
  });

  if (error) {
    log.error("finance.entries", "insert_failed", { code: error.code });
    return { error: dbError(error) };
  }

  revalidatePath(`/${locale}/finance/entries`);
  revalidatePath(`/${locale}/finance`);
  revalidatePath(`/${locale}/finance/cashflow`);
  return { saved: true };
}

/**
 * Remove a typed entry.
 *
 * Reconciled rows are excluded in the query itself, not just hidden in the UI:
 * one of those came from a bank statement and is matched to an import line, so
 * deleting it would leave the line confirmed against nothing and the month
 * would reconcile to a different number than the bank's. Those are corrected
 * on the reconciliation screen, where the statement is.
 */
export async function deleteEntryAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id) return;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const { error } = await supabase.from("fin_entries")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("reconciled", false);

  if (error) log.error("finance.entries", "delete_failed", { code: error.code });

  revalidatePath(`/${locale}/finance/entries`);
  revalidatePath(`/${locale}/finance`);
  revalidatePath(`/${locale}/finance/cashflow`);
}
