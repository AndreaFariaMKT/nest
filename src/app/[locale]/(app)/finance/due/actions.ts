"use server";

import { revalidatePath } from "next/cache";

import { dbError } from "@/lib/db-error";
import { log } from "@/lib/log";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { parseBrlToCents } from "@/lib/money";
import { accrualFor, initialInvoiceStatus } from "@/lib/finance-entry";

export type ObligationFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"description" | "amount" | "due", string>>;
  saved?: boolean;
};

function optional(formData: FormData, key: string) {
  const v = (formData.get(key) ?? "").toString().trim();
  return v.length > 0 ? v : null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCIES = new Set(["BRL", "USD"]);

type CommonFields = {
  description: string;
  amount_cents: number;
  currency: string;
  due_on: string;
  date_accrual: string;
};

type CommonRead =
  | { ok: true; value: CommonFields }
  | { ok: false; state: ObligationFormState };

/** The shared half of both forms: description, amount, currency, two dates. */
function readCommon(formData: FormData): CommonRead {
  const description = (formData.get("description") ?? "").toString().trim();
  if (description.length < 2) {
    return { ok: false, state: { fieldErrors: { description: "tooShort" } } };
  }

  const dueOn = (formData.get("due_on") ?? "").toString().trim();
  if (!ISO_DATE.test(dueOn)) {
    return { ok: false, state: { fieldErrors: { due: "invalid" } } };
  }

  const typedAccrual = optional(formData, "date_accrual");
  if (typedAccrual && !ISO_DATE.test(typedAccrual)) {
    return { ok: false, state: { fieldErrors: { due: "invalid" } } };
  }

  // Amounts here are a positive obligation on both sides — "the studio is owed
  // 4.000" and "the studio owes 1.200". The sign belongs to the ledger entry
  // that settles it, not to the promise, and 054 put a positive-amount CHECK on
  // both tables for exactly that reason.
  const amountCents = parseBrlToCents((formData.get("amount") ?? "").toString());
  if (amountCents === null || amountCents === 0) {
    return { ok: false, state: { fieldErrors: { amount: "invalid" } } };
  }

  const currency = (formData.get("currency") ?? "BRL").toString();

  return {
    ok: true,
    value: {
      description,
      amount_cents: amountCents,
      currency: CURRENCIES.has(currency) ? currency : "BRL",
      due_on: dueOn,
      // Competência defaults to the due date, which is the month the work was
      // agreed for. Defaulting to today would file January's retainer, typed
      // in December, as January revenue in the wrong direction.
      date_accrual: accrualFor(dueOn, typedAccrual),
    },
  };
}

export async function saveReceivableAction(
  _prev: ObligationFormState,
  formData: FormData,
): Promise<ObligationFormState> {
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const common = readCommon(formData);
  if (!common.ok) return common.state;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();
  const clientId = optional(formData, "client_id");

  // An American client's receivable is born `export`: there is no Brazilian
  // nota to ever issue for it, and starting it at `pending` puts it in the
  // nota queue from day one.
  let country: string | null = null;
  if (clientId) {
    const { data } = await supabase
      .from("clients")
      .select("country")
      .eq("id", clientId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    country = data?.country ?? null;
  }

  const { error } = await supabase.from("fin_receivables").insert({
    ...common.value,
    tenant_id: tenantId,
    client_id: clientId,
    project_id: optional(formData, "project_id"),
    status: "open",
    invoice_status: initialInvoiceStatus(country),
  });

  if (error) {
    log.error("finance.receivables", "insert_failed", { code: error.code });
    return { error: dbError(error) };
  }

  revalidatePath(`/${locale}/finance/due`);
  revalidatePath(`/${locale}/finance`);
  return { saved: true };
}

export async function savePayableAction(
  _prev: ObligationFormState,
  formData: FormData,
): Promise<ObligationFormState> {
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const common = readCommon(formData);
  if (!common.ok) return common.state;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const { error } = await supabase.from("fin_payables").insert({
    ...common.value,
    tenant_id: tenantId,
    supplier_id: optional(formData, "supplier_id"),
    category_id: optional(formData, "category_id"),
    project_id: optional(formData, "project_id"),
    status: "open",
  });

  if (error) {
    log.error("finance.payables", "insert_failed", { code: error.code });
    return { error: dbError(error) };
  }

  revalidatePath(`/${locale}/finance/due`);
  revalidatePath(`/${locale}/finance`);
  return { saved: true };
}

/**
 * Give a claimed obligation back.
 *
 * Not a rollback — there is no transaction across two statements here — but it
 * closes the window where a row is marked paid with nothing in the ledger to
 * show for it. Best effort by design: if this fails too, the error log is the
 * only place left to say so.
 */
async function releaseClaim(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  table: "fin_receivables" | "fin_payables",
  id: string,
  tenantId: string,
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update({ paid_on: null, status: "open" })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) log.error("finance.due", "release_failed", { code: error.code });
}

/**
 * Settle an obligation, and record the money moving.
 *
 * The ledger entry is the point. Closing the row alone would take the amount
 * out of "a receber" without ever putting it into the balance, so the studio's
 * money would appear to evaporate on the day it arrived.
 *
 * The account is required for that reason. If the movement is going to come
 * from a bank statement instead, the reconciliation screen settles the
 * obligation and writes the entry in one step — doing both is a double entry,
 * which is why the matcher only ever considers rows still open.
 */
export async function markPaidAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const kind = (formData.get("kind") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const accountId = (formData.get("account_id") ?? "").toString() || null;
  const paidOn = (formData.get("paid_on") ?? "").toString().trim();

  if (!id || !ISO_DATE.test(paidOn)) return;
  if (kind !== "receivable" && kind !== "payable") return;

  const table = kind === "receivable" ? "fin_receivables" : "fin_payables";

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  // The account is required here, not only in the form.
  //
  // It was enforced by `required` on a <select> and by nothing else, while the
  // ledger write sat inside `if (accountId)` and the status update ran either
  // way. Posting the action without the field closed the obligation and wrote
  // no entry: the amount left "a receber", entered no balance, and became
  // invisible — precisely the disappearance the comment above says the account
  // requirement exists to prevent.
  if (!accountId) {
    log.error("finance.due", "settle_without_account", { kind });
    return;
  }

  // And it has to be an account of THIS tenant. A foreign uuid would pass the
  // foreign key — which has no tenant predicate — and produce a ledger row
  // attached to an account no balance query can see.
  const { data: account } = await supabase
    .from("fin_accounts")
    .select("currency")
    .eq("id", accountId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!account) {
    log.error("finance.due", "settle_foreign_account", { kind });
    return;
  }

  // Claim the row BEFORE writing the entry, with the open-check in the update
  // itself.
  //
  // It used to be a read followed by an unconditional update, so a double
  // click had both requests see `paid_on = null`, both insert a ledger row and
  // both mark it paid: R$ 4.000 of receivable became R$ 8.000 of balance, with
  // nothing on any screen that would ever ask about it. Postgres settles the
  // race instead — the second update matches no row and returns nothing.
  const { data: claimedRows, error: claimError } = await supabase
    .from(table)
    .update({ paid_on: paidOn, status: "paid" })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("paid_on", null)
    .neq("status", "cancelled")
    .select("*");

  if (claimError) {
    log.error("finance.due", "claim_failed", { code: claimError.code });
    return;
  }
  const row = claimedRows?.[0];
  // Already settled, cancelled, or not ours. Nothing to do and nothing to say.
  if (!row) return;

  // The money moved through an account that holds a different currency than
  // the obligation was written in, so there is no single amount that is true
  // of both. The form only offers matching accounts; this is the floor under
  // that.
  if (account.currency !== row.currency) {
    await releaseClaim(supabase, table, id, tenantId);
    log.error("finance.due", "settle_currency_mismatch", { kind });
    return;
  }

  {
    // Money in is positive, money out is negative. The obligation stored a
    // magnitude; the direction is what side of the book it was on.
    const signed =
      kind === "receivable"
        ? Math.abs(row.amount_cents)
        : -Math.abs(row.amount_cents);

    let amountBrl: number | null = signed;
    if (row.currency !== "BRL") {
      const { data: rateRows } = await supabase
        .from("fin_fx_rates")
        .select("rate")
        .eq("tenant_id", tenantId)
        .eq("base", "USD")
        .eq("quote", "BRL")
        .lte("day", paidOn)
        .order("day", { ascending: false })
        .limit(1);
      const rate = rateRows?.[0] ? Number(rateRows[0].rate) : null;
      amountBrl = rate === null ? null : Math.round(signed * rate);
    }

    // A receivable carries no category of its own, so revenue is filed under
    // the seeded `receita`. A payable brought its category from the form.
    let categoryId: string | null =
      kind === "payable"
        ? ((row as { category_id: string | null }).category_id ?? null)
        : null;
    if (kind === "receivable") {
      const { data: cat } = await supabase
        .from("fin_categories")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("slug", "receita")
        .maybeSingle();
      categoryId = cat?.id ?? null;
    }

    const { error: entryError } = await supabase.from("fin_entries").insert({
      tenant_id: tenantId,
      account_id: accountId,
      category_id: categoryId,
      description: row.description,
      amount_cents: signed,
      amount_brl_cents: amountBrl,
      currency: row.currency,
      date_cash: paidOn,
      // The month it BELONGS to travels with the obligation. August's retainer
      // paid on 5 September is September's cash and August's revenue — writing
      // the cash date into both is the conflation the two-date model exists to
      // prevent.
      date_accrual: row.date_accrual,
      client_id:
        kind === "receivable"
          ? ((row as { client_id: string | null }).client_id ?? null)
          : null,
      supplier_id:
        kind === "payable"
          ? ((row as { supplier_id: string | null }).supplier_id ?? null)
          : null,
      project_id: (row as { project_id: string | null }).project_id ?? null,
      reconciled: false,
    });

    // The obligation stays open if the ledger write failed. A closed row with
    // no entry behind it is money that vanished, and it is invisible: nothing
    // on any screen would ever ask about it again.
    // The claim is given back when the ledger write fails. Without this the
    // obligation would be closed with no entry behind it — the same
    // disappearance as settling with no account, reached by a different route.
    if (entryError) {
      await releaseClaim(supabase, table, id, tenantId);
      log.error("finance.due", "entry_failed", { code: entryError.code });
      return;
    }
  }

  revalidatePath(`/${locale}/finance/due`);
  revalidatePath(`/${locale}/finance`);
  revalidatePath(`/${locale}/finance/entries`);
  revalidatePath(`/${locale}/finance/invoicing`);
}

export async function cancelObligationAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const kind = (formData.get("kind") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id || (kind !== "receivable" && kind !== "payable")) return;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  // Cancelled, not deleted: a contract that fell through is part of the year's
  // story, and `isOpen` already excludes it from every total.
  const { error } = await supabase
    .from(kind === "receivable" ? "fin_receivables" : "fin_payables")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("paid_on", null);

  if (error) log.error("finance.due", "cancel_failed", { code: error.code });

  revalidatePath(`/${locale}/finance/due`);
  revalidatePath(`/${locale}/finance`);
}

export async function deleteObligationAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const kind = (formData.get("kind") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id || (kind !== "receivable" && kind !== "payable")) return;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  // Only what was never settled. A paid row has a ledger entry behind it, and
  // removing the obligation would orphan the money it explains.
  const { error } = await supabase
    .from(kind === "receivable" ? "fin_receivables" : "fin_payables")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("paid_on", null);

  if (error) log.error("finance.due", "delete_failed", { code: error.code });

  revalidatePath(`/${locale}/finance/due`);
  revalidatePath(`/${locale}/finance`);
}
