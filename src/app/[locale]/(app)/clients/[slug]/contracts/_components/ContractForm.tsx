"use client";

import { FormError } from "@/components/ui/FormError";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import type { Database } from "@/types/database";
import type { ContractFormState } from "../actions";

type Contract = Database["public"]["Tables"]["contracts"]["Row"];

function centsToReaisInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function ContractForm({
  locale,
  clientId,
  clientSlug,
  initial,
  action,
  submitLabel,
  cancelHref,
}: {
  locale: string;
  clientId: string;
  clientSlug: string;
  initial?: Contract | null;
  action: (
    state: ContractFormState,
    formData: FormData,
  ) => Promise<ContractFormState>;
  submitLabel: string;
  cancelHref: `/clients/${string}/contracts`;
}) {
  const t = useTranslations("contracts");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState<
    ContractFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="clientSlug" value={clientSlug} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="title">{t("fields.title")}</Label>
        <Input
          id="title"
          name="title"
          required
          minLength={2}
          maxLength={120}
          defaultValue={initial?.title ?? ""}
        />
        {state.fieldErrors?.title ? (
          <p className="text-xs text-destructive">
            {t(`errors.${state.fieldErrors.title}`)}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="monthly_value">{t("fields.monthlyValue")}</Label>
          <Input
            id="monthly_value"
            name="monthly_value"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={centsToReaisInput(initial?.monthly_value_cents)}
          />
          {state.fieldErrors?.monthly_value ? (
            <p className="text-xs text-destructive">
              {t(`errors.${state.fieldErrors.monthly_value}`)}
            </p>
          ) : null}
        </div>
        <div className="flex items-end pb-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="auto_renew"
              defaultChecked={initial?.auto_renew ?? true}
              className="h-4 w-4"
            />
            {t("fields.autoRenew")}
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="starts_on">{t("fields.startsOn")}</Label>
          <Input
            id="starts_on"
            name="starts_on"
            type="date"
            required
            defaultValue={initial?.starts_on ?? ""}
          />
          {state.fieldErrors?.starts_on ? (
            <p className="text-xs text-destructive">
              {t(`errors.${state.fieldErrors.starts_on}`)}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ends_on">{t("fields.endsOn")}</Label>
          <Input
            id="ends_on"
            name="ends_on"
            type="date"
            defaultValue={initial?.ends_on ?? ""}
          />
          {state.fieldErrors?.ends_on ? (
            <p className="text-xs text-destructive">
              {t(`errors.${state.fieldErrors.ends_on}`)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="document_url">{t("fields.documentUrl")}</Label>
        <Input
          id="document_url"
          name="document_url"
          type="url"
          placeholder="https://"
          maxLength={300}
          defaultValue={initial?.document_url ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("fields.notes")}</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={initial?.notes ?? ""}
        />
      </div>

      {state.error ? (
        <FormError error={state.error} />
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Link
          href={cancelHref}
          className="inline-flex h-10 items-center rounded-md px-4 text-sm text-muted-foreground hover:text-foreground"
        >
          {tCommon("cancel")}
        </Link>
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("loading") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
