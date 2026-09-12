"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { APP_ROLES } from "@/lib/roles";
import { addMemberAction, type AddMemberState } from "../actions";

export function InviteForm({ locale }: { locale: string }) {
  const t = useTranslations("team");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState<
    AddMemberState,
    FormData
  >(addMemberAction, {});

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
          <Label htmlFor="job_title">{t("fields.jobTitle")}</Label>
          <Input id="job_title" name="job_title" maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="department">{t("fields.department")}</Label>
          <Input id="department" name="department" maxLength={120} />
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
        <div className="flex flex-wrap items-end gap-2">
          {/* Two buttons, one set of fields. The button's own name and value
              reach the action, so which path runs is decided by the one that
              was pressed — no hidden state to keep in step with the UI. */}
          <Button
            type="submit"
            name="mode"
            value="invite"
            disabled={isPending}
            className="h-10"
          >
            {isPending ? tCommon("loading") : t("invite")}
          </Button>
          <Button
            type="submit"
            name="mode"
            value="password"
            variant="secondary"
            disabled={isPending}
            className="h-10"
          >
            {t("createWithPassword")}
          </Button>
        </div>
      </div>

      {/* Why the second button exists, next to it rather than in a doc. */}
      <p className="text-xs text-muted-foreground">{t("noEmailHint")}</p>
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

      {/* The one moment this password is readable. It is not logged and not
          stored — GoTrue keeps a hash — so losing it here means setting a new
          one, not looking this one up. Said plainly, because a person who
          navigates away expecting to find it later will not. */}
      {state.created ? (
        <div
          role="status"
          data-testid="created-credentials"
          className="space-y-2 rounded-xl border border-border bg-muted/40 p-4"
        >
          <p className="text-sm font-medium">
            {t("created.title", { email: state.created.email })}
          </p>
          <p className="select-all font-mono text-lg tracking-wide">
            {state.created.password}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("created.warning")}
          </p>
        </div>
      ) : null}
    </form>
  );
}
