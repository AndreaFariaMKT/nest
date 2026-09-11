"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormError } from "@/components/ui/FormError";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { saveAccountAction, type AccountFormState } from "./actions";
import type { AccountRow } from "@/lib/finance-db";

const initial: AccountFormState = {};

const CURRENCIES = ["BRL", "USD"] as const;
const KINDS = ["operacional", "reserva"] as const;

export function AccountForm({
  locale,
  account,
}: {
  locale: string;
  account?: AccountRow;
}) {
  const t = useTranslations("finance.accounts");
  const [state, action, pending] = useActionState(saveAccountAction, initial);
  const uid = account?.id ?? "new";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {account ? <input type="hidden" name="id" value={account.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`name-${uid}`}>{t("name")}</Label>
          <Input
            id={`name-${uid}`}
            name="name"
            required
            maxLength={120}
            placeholder={t("namePlaceholder")}
            defaultValue={account?.name ?? ""}
          />
          {state.fieldErrors?.name ? (
            <FormError error={t(`errors.${state.fieldErrors.name}`)} />
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`institution-${uid}`}>{t("institution")}</Label>
          <Input
            id={`institution-${uid}`}
            name="institution"
            maxLength={80}
            placeholder={t("institutionPlaceholder")}
            defaultValue={account?.institution ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`currency-${uid}`}>{t("currency")}</Label>
          <Select
            id={`currency-${uid}`}
            name="currency"
            defaultValue={account?.currency ?? "BRL"}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`kind-${uid}`}>{t("kind")}</Label>
          {/* The reserve is deliberately outside working capital: it exists to
              not be spent, and counting it as operating money is how a studio
              believes it has four months of runway when it has one. */}
          <Select
            id={`kind-${uid}`}
            name="kind"
            defaultValue={account?.kind ?? "operacional"}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {state.error ? <FormError error={state.error} /> : null}

      <Button type="submit" disabled={pending}>
        {account ? t("save") : t("add")}
      </Button>
    </form>
  );
}
