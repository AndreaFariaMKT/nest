"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { FormError } from "@/components/ui/FormError";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { saveEntryAction, type EntryFormState } from "./actions";

const initial: EntryFormState = {};

export type Option = { id: string; name: string };
export type AccountOption = Option & { currency: string };
export type CategoryOption = Option & { kind: string };

export function EntryForm({
  locale,
  today,
  accounts,
  categories,
  clients,
  projects,
  suppliers,
}: {
  locale: string;
  today: string;
  accounts: AccountOption[];
  categories: CategoryOption[];
  clients: Option[];
  projects: Option[];
  suppliers: Option[];
}) {
  const t = useTranslations("finance.entries");
  const [state, action, pending] = useActionState(saveEntryAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Account and date stay put across saves on purpose: entering a month of
  // movements means typing ten rows against the same account, and a picker
  // that resets to the top of the list every time is ten chances to file a
  // payment in the wrong place. Controlled values survive form.reset().
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [dateCash, setDateCash] = useState(today);
  const [direction, setDirection] = useState<"in" | "out">("out");

  useEffect(() => {
    if (state.saved) formRef.current?.reset();
  }, [state]);

  const currency =
    accounts.find((a) => a.id === accountId)?.currency ?? "BRL";

  // A movement out cannot be Receita, and one in cannot be Equipe. Transfers
  // show on both sides because that is what a transfer is.
  const visibleCategories = categories.filter(
    (c) =>
      c.kind === "transfer" ||
      (direction === "in" ? c.kind === "income" : c.kind === "expense"),
  );

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="direction">{t("direction")}</Label>
          <Select
            id="direction"
            name="direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value as "in" | "out")}
          >
            <option value="out">{t("directions.out")}</option>
            <option value="in">{t("directions.in")}</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="amount">
            {t("amount")} <span className="text-muted-foreground">· {currency}</span>
          </Label>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            required
            placeholder={currency === "USD" ? "0,00" : "R$ 0,00"}
          />
          {state.fieldErrors?.amount ? (
            <FormError error={t(`errors.${state.fieldErrors.amount}`)} />
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date_cash">{t("dateCash")}</Label>
          <Input
            id="date_cash"
            name="date_cash"
            type="date"
            required
            value={dateCash}
            onChange={(e) => setDateCash(e.target.value)}
          />
          {state.fieldErrors?.date ? (
            <FormError error={t(`errors.${state.fieldErrors.date}`)} />
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date_accrual">{t("dateAccrual")}</Label>
          {/* Blank means "the same month as the cash", which is the common
              case. It is here for the retainer earned in August and paid in
              September — the one thing a single date column cannot express. */}
          <Input id="date_accrual" name="date_accrual" type="date" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">{t("description")}</Label>
        <Input
          id="description"
          name="description"
          required
          maxLength={200}
          placeholder={t("descriptionPlaceholder")}
        />
        {state.fieldErrors?.description ? (
          <FormError error={t(`errors.${state.fieldErrors.description}`)} />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="account_id">{t("account")}</Label>
          <Select
            id="account_id"
            name="account_id"
            required
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.currency}
              </option>
            ))}
          </Select>
          {state.fieldErrors?.account ? (
            <FormError error={t(`errors.${state.fieldErrors.account}`)} />
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category_id">{t("category")}</Label>
          <Select id="category_id" name="category_id">
            <option value="">—</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="client_id">{t("client")}</Label>
          <Select id="client_id" name="client_id">
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="project_id">{t("project")}</Label>
          <Select id="project_id" name="project_id">
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="supplier_id">{t("supplier")}</Label>
          <Select id="supplier_id" name="supplier_id">
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {state.error ? <FormError error={state.error} /> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || accounts.length === 0}>
          {t("add")}
        </Button>
        {accounts.length === 0 ? (
          <span className="text-xs text-destructive">{t("needAccount")}</span>
        ) : null}
      </div>
    </form>
  );
}
