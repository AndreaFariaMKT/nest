"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormError } from "@/components/ui/FormError";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { saveSupplierAction, type SupplierFormState } from "./actions";
import type { SupplierRow } from "@/lib/finance-db";

const initial: SupplierFormState = {};

const NOTE_STATUSES = ["pending", "collected", "not_required"] as const;

export function SupplierForm({
  locale,
  supplier,
}: {
  locale: string;
  supplier?: SupplierRow;
}) {
  const t = useTranslations("finance.suppliers");
  const [state, action, pending] = useActionState(saveSupplierAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`name-${supplier?.id ?? "new"}`}>{t("name")}</Label>
          <Input
            id={`name-${supplier?.id ?? "new"}`}
            name="name"
            required
            maxLength={120}
            defaultValue={supplier?.name ?? ""}
          />
          {state.fieldErrors?.name ? (
            <FormError error={t(`errors.${state.fieldErrors.name}`)} />
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`category-${supplier?.id ?? "new"}`}>
            {t("category")}
          </Label>
          <Input
            id={`category-${supplier?.id ?? "new"}`}
            name="category"
            maxLength={80}
            defaultValue={supplier?.category ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`doc_type-${supplier?.id ?? "new"}`}>
            {t("docType")}
          </Label>
          {/* Which one it is matters: recurring payments to a pessoa física can
              carry withholding that payments to a CNPJ do not, and the studio
              pays two people by CPF every month. */}
          <select
            id={`doc_type-${supplier?.id ?? "new"}`}
            name="doc_type"
            defaultValue={supplier?.doc_type ?? ""}
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">—</option>
            <option value="cpf">CPF</option>
            <option value="cnpj">CNPJ</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`doc_number-${supplier?.id ?? "new"}`}>
            {t("docNumber")}
          </Label>
          <Input
            id={`doc_number-${supplier?.id ?? "new"}`}
            name="doc_number"
            maxLength={32}
            defaultValue={supplier?.doc_number ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`pix_key-${supplier?.id ?? "new"}`}>{t("pix")}</Label>
          <Input
            id={`pix_key-${supplier?.id ?? "new"}`}
            name="pix_key"
            maxLength={140}
            defaultValue={supplier?.pix_key ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`default_amount-${supplier?.id ?? "new"}`}>
            {t("defaultAmount")}
          </Label>
          <Input
            id={`default_amount-${supplier?.id ?? "new"}`}
            name="default_amount"
            inputMode="decimal"
            placeholder="R$ 0,00"
            defaultValue={
              supplier?.default_amount_cents != null
                ? (supplier.default_amount_cents / 100).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })
                : ""
            }
          />
          {state.fieldErrors?.amount ? (
            <FormError error={t(`errors.${state.fieldErrors.amount}`)} />
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`pay_day-${supplier?.id ?? "new"}`}>
            {t("payDay")}
          </Label>
          <Input
            id={`pay_day-${supplier?.id ?? "new"}`}
            name="pay_day"
            type="number"
            min={1}
            max={31}
            defaultValue={supplier?.pay_day ?? ""}
          />
          {state.fieldErrors?.payDay ? (
            <FormError error={t(`errors.${state.fieldErrors.payDay}`)} />
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`note_status-${supplier?.id ?? "new"}`}>
            {t("noteStatus")}
          </Label>
          <select
            id={`note_status-${supplier?.id ?? "new"}`}
            name="note_status"
            defaultValue={supplier?.note_status ?? "pending"}
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {NOTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`note.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error ? <FormError error={state.error} /> : null}

      <Button type="submit" disabled={pending}>
        {supplier ? t("save") : t("add")}
      </Button>
    </form>
  );
}
