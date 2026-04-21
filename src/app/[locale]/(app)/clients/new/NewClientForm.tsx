"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { createClientAction, type CreateClientState } from "../actions";

const initialState: CreateClientState = {};

export function NewClientForm({ locale }: { locale: string }) {
  const t = useTranslations("clients");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(
    createClientAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />

      <div className="space-y-1.5">
        <Label htmlFor="name">{t("fields.name")}</Label>
        <Input id="name" name="name" required minLength={2} maxLength={120} />
        {state.fieldErrors?.name ? (
          <p className="text-xs text-destructive">
            {t(`errors.${state.fieldErrors.name}`)}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="industry">{t("fields.industry")}</Label>
        <Input id="industry" name="industry" maxLength={80} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="website">{t("fields.website")}</Label>
        <Input
          id="website"
          name="website"
          type="url"
          placeholder="https://"
          maxLength={200}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("fields.notes")}</Label>
        <Textarea id="notes" name="notes" rows={4} maxLength={2000} />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Link
          href="/clients"
          className="inline-flex h-10 items-center rounded-md px-4 text-sm text-muted-foreground hover:text-foreground"
        >
          {tCommon("cancel")}
        </Link>
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("loading") : t("createSubmit")}
        </Button>
      </div>
    </form>
  );
}
