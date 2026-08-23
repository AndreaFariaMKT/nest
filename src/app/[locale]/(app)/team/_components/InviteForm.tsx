"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
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
        <div className="flex items-end">
          <Button type="submit" disabled={isPending} className="h-10">
            {isPending ? tCommon("loading") : t("invite")}
          </Button>
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">
          {state.error === "unauthorized"
            ? t("errors.ownerOnly")
            : t("errors.inviteFailed")}
        </p>
      ) : null}
      {state.success ? (
        <p
          className="text-sm text-emerald-700 dark:text-emerald-300"
          data-testid="invite-success"
        >
          {t("inviteSent", { email: state.success })}
        </p>
      ) : null}
    </form>
  );
}
