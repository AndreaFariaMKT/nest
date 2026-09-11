"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormError } from "@/components/ui/FormError";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { importStatementAction, type ImportState } from "./actions";

const initial: ImportState = {};

export function ImportForm({
  locale,
  accounts,
}: {
  locale: string;
  accounts: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("finance.reconcile");
  const [state, action, pending] = useActionState(importStatementAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="account_id">{t("account")}</Label>
          <Select id="account_id" name="account_id">
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="file">{t("file")}</Label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".ofx,.csv,text/csv"
            required
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm"
          />
        </div>
      </div>

      {state.error ? <FormError error={t(`errors.${state.error}`)} /> : null}

      {state.imported !== undefined ? (
        <p className="text-sm text-muted-foreground">
          {t("result", {
            imported: state.imported,
            skipped: state.skipped ?? 0,
            unreadable: state.unreadable ?? 0,
          })}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? t("reading") : t("import")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("nothingWritten")}</p>
    </form>
  );
}
