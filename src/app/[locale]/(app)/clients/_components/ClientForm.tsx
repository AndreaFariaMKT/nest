"use client";

import { FormError } from "@/components/ui/FormError";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import type { ClientFormState, ClientStatus } from "../actions";

type ClientFormValues = {
  id?: string;
  name?: string | null;
  industry?: string | null;
  website?: string | null;
  notes?: string | null;
  status?: ClientStatus;
  socialEnabled?: boolean;
  postsPerCycle?: number;
};

const statuses: ClientStatus[] = ["prospect", "active", "paused", "archived"];

export function ClientForm({
  locale,
  initial,
  action,
  submitLabel,
  cancelHref,
  showStatus = false,
}: {
  locale: string;
  initial?: ClientFormValues;
  action: (
    state: ClientFormState,
    formData: FormData,
  ) => Promise<ClientFormState>;
  submitLabel: string;
  cancelHref: "/clients" | `/clients/${string}`;
  showStatus?: boolean;
}) {
  const t = useTranslations("clients");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {initial?.id ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

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
        <Label htmlFor="industry">{t("fields.industry")}</Label>
        <Input
          id="industry"
          name="industry"
          maxLength={80}
          defaultValue={initial?.industry ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="website">{t("fields.website")}</Label>
        <Input
          id="website"
          name="website"
          type="url"
          placeholder="https://"
          maxLength={200}
          defaultValue={initial?.website ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("fields.notes")}</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={2000}
          defaultValue={initial?.notes ?? ""}
        />
      </div>

      {showStatus ? (
        <div className="space-y-1.5">
          <Label htmlFor="status">{t("fields.status")}</Label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "active"}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showStatus ? (
        <fieldset className="space-y-3 rounded-md border border-border p-4">
          <legend className="px-1 text-sm font-medium text-foreground">
            {t("social.legend")}
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="social_enabled"
              defaultChecked={initial?.socialEnabled ?? true}
              className="h-4 w-4 rounded border-input"
            />
            {t("social.enabled")}
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="posts_per_cycle">{t("social.postsPerCycle")}</Label>
            <Input
              id="posts_per_cycle"
              name="posts_per_cycle"
              type="number"
              min={1}
              max={40}
              defaultValue={initial?.postsPerCycle ?? 2}
              className="max-w-[8rem]"
            />
            <p className="text-xs text-muted-foreground">
              {t("social.postsPerCycleHint")}
            </p>
          </div>
          {state.fieldErrors?.posts_per_cycle ? (
            <p className="text-xs text-destructive">
              {t(`errors.${state.fieldErrors.posts_per_cycle}`)}
            </p>
          ) : null}
        </fieldset>
      ) : null}

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
