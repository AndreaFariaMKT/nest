import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill, toneOf, type Tone } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { formatCentsAsBrl } from "@/lib/money";
import {
  type AccountRow,
  type CategoryRow,
  type ImportLineRow,
} from "@/lib/finance-db";
import { ImportForm } from "./ImportForm";
import { confirmLineAction, discardLineAction } from "./actions";

export const dynamic = "force-dynamic";

const kindTone = {
  auto: "success",
  suggested: "warning",
  unmatched: "danger",
} as const satisfies Record<string, Tone>;


export default async function ReconcilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("finance.reconcile");

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const [{ data: lineData }, { data: accountData }, { data: categoryData }] =
    await Promise.all([
      supabase.from("fin_import_lines")
        .select("*, import:fin_imports(account_id)")
        .eq("tenant_id", tenantId)
        .is("confirmed_at", null)
        .order("date", { ascending: true })
        .limit(OPTION_LIST_CAP),
      supabase.from("fin_accounts")
        .select("id, tenant_id, name, institution, currency, kind, is_active")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase.from("fin_categories")
        .select("id, name, slug, kind, sort")
        .eq("tenant_id", tenantId)
        .order("sort", { ascending: true }),
    ]);

  const lines = (lineData ?? []) as ImportLineRow[];
  const accounts = (accountData ?? []) as AccountRow[];
  const categories = (categoryData ?? []) as CategoryRow[];

  const counts = {
    auto: lines.filter((l) => l.match_kind === "auto").length,
    suggested: lines.filter((l) => l.match_kind === "suggested").length,
    unmatched: lines.filter((l) => l.match_kind === "unmatched").length,
  };

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("addFile")}
        </h2>
        <ImportForm
          locale={locale}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        />
      </section>

      {lines.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {t("nothingStaged")}
        </p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {(["auto", "suggested", "unmatched"] as const).map((k) => (
              <div key={k} className="rounded-2xl border border-border bg-card p-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t(`kinds.${k}`)}
                </div>
                <div className="mt-2 font-display text-2xl leading-none">
                  {counts[k]}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t(`kindHints.${k}`)}
                </div>
              </div>
            ))}
          </div>

          <ul className="space-y-2">
            {lines.map((line) => (
              <li
                key={line.id}
                className="rounded-2xl border border-border bg-card p-4"
                data-testid="import-line"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {line.date}
                      </span>
                      <Pill tone={toneOf(kindTone, line.match_kind)}>
                        {t(`kinds.${line.match_kind}`)}
                      </Pill>
                      {/* Why it is not `auto`, said in words. An unexplained
                          amber badge makes the person re-derive the matcher's
                          reasoning on every line. */}
                      {line.match_reasons.map((r) => (
                        <span
                          key={r}
                          className="text-xs text-muted-foreground"
                        >
                          {t(`reasons.${r}`)}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {line.description}
                    </div>
                  </div>
                  <div
                    className={`shrink-0 tabular-nums ${
                      line.amount_cents >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : ""
                    }`}
                  >
                    {formatCentsAsBrl(line.amount_cents)}
                  </div>
                </div>

                <form
                  action={confirmLineAction}
                  className="mt-3 flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="id" value={line.id} />
                  <input type="hidden" name="locale" value={locale} />
                  <label className="text-xs text-muted-foreground">
                    {t("category")}
                    <Select name="category_id" className="mt-1 h-9 w-auto">
                      <option value="">—</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="text-xs text-muted-foreground">
                    {t("account")}
                    {/* Pre-selected from the statement's own account. Left
                        blank, confirming wrote a null account and the entry
                        dropped out of every balance while still counting in
                        the month's totals. */}
                    <Select
                      name="account_id"
                      className="mt-1 h-9 w-auto"
                      defaultValue={
                        (line as { import?: { account_id: string | null } | null })
                          .import?.account_id ?? ""
                      }
                    >
                      <option value="">—</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <button
                    type="submit"
                    className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {t("confirm")}
                  </button>
                </form>

                <form action={discardLineAction} className="mt-2">
                  <input type="hidden" name="id" value={line.id} />
                  <input type="hidden" name="locale" value={locale} />
                  <button
                    type="submit"
                    className="text-xs text-muted-foreground underline underline-offset-4 hover:text-destructive"
                  >
                    {t("discard")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
