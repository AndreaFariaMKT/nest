"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { APP_ROLES } from "@/lib/roles";
import { inviteMemberAction, type InviteMemberState } from "../actions";

export function InviteForm({ locale }: { locale: string }) {
  const t = useTranslations("team");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState<
    InviteMemberState,
    FormData
  >(inviteMemberAction, {});

  return (
    <form action={formAction} className="space-y-3" data-testid="invite-form">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("fields.email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="colega@studio.com"
          />
          {state.fieldErrors?.email ? (
            <p className="text-xs text-destructive">
              {t(`errors.${state.fieldErrors.email}`)}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="full_name">{t("fields.fullName")}</Label>
          <Input id="full_name" name="full_name" maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">{t("fields.role")}</Label>
          {/* Required, with no pre-selected value. The role decides what the
              person sees on their first login, and defaulting it quietly is
              how someone ends up with publishing credentials they were never
              meant to hold. */}
          <select
            id="role"
            name="role"
            required
            defaultValue=""
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              {t("pickRole")}
            </option>
            {APP_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`appRoles.${r}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={isPending} className="h-10">
            {isPending ? tCommon("loading") : t("invite")}
          </Button>
        </div>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error === "unauthorized"
            ? t("errors.ownerOnly")
            : t(`errors.${state.error}`)}
        </p>
      ) : null}
      {state.success ? (
        <p
          className="text-sm text-emerald-700 dark:text-emerald-300"
          data-testid="invite-success"
          role="status"
        >
          {t("inviteSent", { email: state.success })}
        </p>
      ) : null}
    </form>
  );
}
