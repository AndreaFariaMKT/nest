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
import type { ServiceFormState } from "../actions";

type Service = Database["public"]["Tables"]["services"]["Row"];

function centsToReaisInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function ServiceForm({
  locale,
  initial,
  action,
  submitLabel,
}: {
  locale: string;
  initial?: Service | null;
  action: (
    state: ServiceFormState,
    formData: FormData,
  ) => Promise<ServiceFormState>;
  submitLabel: string;
}) {
  const t = useTranslations("services");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState<
    ServiceFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="name">{t("fields.name")}</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={initial?.name ?? ""}
        />
        {state.fieldErrors?.name ? (
          <p className="text-xs text-destructive">
            {t(`errors.${state.fieldErrors.name}`)}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="default_monthly">{t("fields.defaultMonthly")}</Label>
        <Input
          id="default_monthly"
          name="default_monthly"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={centsToReaisInput(initial?.default_monthly_cents)}
        />
        {state.fieldErrors?.default_monthly ? (
          <p className="text-xs text-destructive">
            {t(`errors.${state.fieldErrors.default_monthly}`)}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">{t("fields.description")}</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={initial?.description ?? ""}
        />
      </div>

      {state.error ? (
        <FormError error={state.error} />
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Link
          href="/services"
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
