"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { FormError } from "@/components/ui/FormError";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import {
  saveReceivableAction,
  savePayableAction,
  type ObligationFormState,
} from "./actions";

const initial: ObligationFormState = {};

export type Option = { id: string; name: string };

/**
 * One form for both sides.
 *
 * A receivable and a payable differ in exactly two fields — who owes whom, and
 * whether a category applies — and are identical in the four that matter:
 * description, amount, due date and competência. Two components would be two
 * places to forget the accrual field.
 */
export function ObligationForm({
  kind,
  locale,
  today,
  clients,
  projects,
  suppliers,
  categories,
}: {
  kind: "receivable" | "payable";
  locale: string;
  today: string;
  clients?: Option[];
  projects: Option[];
  suppliers?: Option[];
  categories?: Option[];
}) {
  const t = useTranslations("finance.due");
  const [state, action, pending] = useActionState(
    kind === "receivable" ? saveReceivableAction : savePayableAction,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.saved) formRef.current?.reset();
  }, [state]);

  const id = (field: string) => `${kind}-${field}`;

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <div className="space-y-1.5">
        <Label htmlFor={id("description")}>{t("description")}</Label>
        <Input
          id={id("description")}
          name="description"
          required
          maxLength={200}
          placeholder={t(`${kind}.descriptionPlaceholder`)}
        />
        {state.fieldErrors?.description ? (
          <FormError error={t(`errors.${state.fieldErrors.description}`)} />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={id("counterparty")}>
            {kind === "receivable" ? t("client") : t("supplier")}
          </Label>
          {kind === "receivable" ? (
            <Select id={id("counterparty")} name="client_id">
              <option value="">—</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          ) : (
            <Select id={id("counterparty")} name="supplier_id">
              <option value="">—</option>
              {(suppliers ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={id("project")}>{t("project")}</Label>
          <Select id={id("project")} name="project_id">
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {kind === "payable" ? (
        <div className="space-y-1.5">
          <Label htmlFor={id("category")}>{t("category")}</Label>
          <Select id={id("category")} name="category_id">
            <option value="">—</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor={id("amount")}>{t("amount")}</Label>
          <Input
            id={id("amount")}
            name="amount"
            inputMode="decimal"
            required
            placeholder="0,00"
          />
          {state.fieldErrors?.amount ? (
            <FormError error={t(`errors.${state.fieldErrors.amount}`)} />
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={id("currency")}>{t("currency")}</Label>
          <Select id={id("currency")} name="currency" defaultValue="BRL">
            <option value="BRL">BRL</option>
            <option value="USD">USD</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={id("due")}>{t("dueOn")}</Label>
          <Input
            id={id("due")}
            name="due_on"
            type="date"
            required
            defaultValue={today}
          />
          {state.fieldErrors?.due ? (
            <FormError error={t(`errors.${state.fieldErrors.due}`)} />
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={id("accrual")}>{t("dateAccrual")}</Label>
          {/* Blank follows the due date. Filled, it is what puts August's
              retainer in August's profit whatever month it is paid in. */}
          <Input id={id("accrual")} name="date_accrual" type="date" />
        </div>
      </div>

      {state.error ? <FormError error={state.error} /> : null}

      <Button type="submit" disabled={pending}>
        {t(`${kind}.add`)}
      </Button>
    </form>
  );
}
