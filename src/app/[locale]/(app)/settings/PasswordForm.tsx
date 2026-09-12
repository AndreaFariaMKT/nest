"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { FormError } from "@/components/ui/FormError";
import { MIN_PASSWORD_LENGTH } from "@/lib/temp-password";
import { changePasswordAction, type PasswordState } from "./actions";

const initial: PasswordState = {};

export function PasswordForm() {
  const t = useTranslations("settings.password");
  const [state, action, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("new")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmation">{t("confirm")}</Label>
          <Input
            id="confirmation"
            name="confirmation"
            type="password"
            required
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("hint", { min: MIN_PASSWORD_LENGTH })}
      </p>

      {state.fieldErrors?.password ? (
        <FormError error={t(`errors.${state.fieldErrors.password}`)} />
      ) : null}
      {state.error ? <FormError error={t(`errors.${state.error}`)} /> : null}
      {state.ok ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {t("done")}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
