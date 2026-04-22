"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import {
  createTranscriptAction,
  type TranscriptFormState,
} from "../actions";

export type ClientOption = { id: string; name: string };

export function TranscriptForm({
  locale,
  clients,
}: {
  locale: string;
  clients: ClientOption[];
}) {
  const t = useTranslations("contentEngine");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState<
    TranscriptFormState,
    FormData
  >(createTranscriptAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />

      <div className="space-y-1.5">
        <Label htmlFor="client_id">{t("fields.client")}</Label>
        <select
          id="client_id"
          name="client_id"
          required
          defaultValue=""
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="" disabled>
            {t("fields.pickClient")}
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.client_id ? (
          <p className="text-xs text-destructive">
            {t(`errors.${state.fieldErrors.client_id}`)}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="content">{t("fields.pasteTranscript")}</Label>
          <Textarea
            id="content"
            name="content"
            rows={10}
            maxLength={100_000}
            placeholder={t("placeholders.paste")}
          />
          {state.fieldErrors?.content ? (
            <p className="text-xs text-destructive">
              {t(`errors.${state.fieldErrors.content}`)}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="language">{t("fields.language")}</Label>
          <Input
            id="language"
            name="language"
            defaultValue="pt-BR"
            maxLength={10}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="file">{t("fields.orUpload")}</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".txt,.vtt,text/plain,text/vtt"
          className="block text-sm"
          data-testid="transcript-file"
        />
        <p className="text-xs text-muted-foreground">
          {t("assets.hint")}
        </p>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Link
          href="/content-engine"
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
