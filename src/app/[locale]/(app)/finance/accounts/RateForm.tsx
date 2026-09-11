"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormError } from "@/components/ui/FormError";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { saveRateAction, type RateFormState } from "./actions";

const initial: RateFormState = {};

export function RateForm({ locale, today }: { locale: string; today: string }) {
  const t = useTranslations("finance.accounts.fx");
  const [state, action, pending] = useActionState(saveRateAction, initial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="locale" value={locale} />

      <div className="space-y-1.5">
        <Label htmlFor="fx-day">{t("day")}</Label>
        {/* Defaults to today and stays editable: the rate for a movement is
            the rate on the day it moved, and August's dollars are not owed
            today's number. */}
        <Input id="fx-day" name="day" type="date" defaultValue={today} required />
        {state.fieldErrors?.day ? (
          <FormError error={t(`errors.${state.fieldErrors.day}`)} />
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fx-rate">{t("rate")}</Label>
        <Input
          id="fx-rate"
          name="rate"
          inputMode="decimal"
          placeholder="5,37"
          required
          className="w-32"
        />
        {state.fieldErrors?.rate ? (
          <FormError error={t(`errors.${state.fieldErrors.rate}`)} />
        ) : null}
      </div>

      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>

      {state.error ? <FormError error={state.error} /> : null}
    </form>
  );
}
