"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Pill } from "@/components/ui/Pill";
import { Textarea } from "@/components/ui/Textarea";
import { DOCUMENT_CATEGORIES, type Expiry } from "@/lib/company-documents";
import {
  deleteCompanyDocumentAction,
  saveCompanyDocumentAction,
  type DocumentState,
} from "./actions";

const initial: DocumentState = { ok: false };

export type CompanyDoc = {
  id: string;
  title: string;
  category: string;
  document_url: string | null;
  notes: string | null;
  valid_until: string | null;
  expiry: Expiry;
  expiresLabel: string | null;
};

const TONE: Record<Expiry, "danger" | "warning" | "success" | "muted"> = {
  expired: "danger",
  soon: "warning",
  ok: "success",
  none: "muted",
};

/**
 * The studio's own documents, editable in place.
 *
 * Sorted by the domain rather than by name: expired first, then expiring, then
 * the rest. This screen is opened to answer "is anything about to lapse", so
 * the answer is the top of the list and not something to scan for.
 */
export function CompanyDocuments({
  docs,
  locale,
}: {
  docs: CompanyDoc[];
  locale: string;
}) {
  const t = useTranslations("administration");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl leading-snug">{t("company")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("companyNote")}
          </p>
        </div>
        {!adding ? (
          <Button onClick={() => setAdding(true)}>{t("add")}</Button>
        ) : null}
      </div>

      {adding ? (
        <DocForm
          locale={locale}
          onDone={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      {docs.length === 0 && !adding ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-8 py-12 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) =>
            editing === d.id ? (
              <li key={d.id}>
                <DocForm
                  doc={d}
                  locale={locale}
                  onDone={() => setEditing(null)}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li
                key={d.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{d.title}</span>
                    <Pill tone="muted">{t(`category.${d.category}`)}</Pill>
                    <Pill tone={TONE[d.expiry]}>{t(`expiry.${d.expiry}`)}</Pill>
                  </div>
                  {d.expiresLabel ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("expiresOn", { date: d.expiresLabel })}
                    </p>
                  ) : null}
                  {d.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">{d.notes}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  {d.document_url ? (
                    <a
                      href={d.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:underline"
                    >
                      {t("open")} →
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setEditing(d.id)}
                    className="text-muted-foreground hover:underline"
                  >
                    {t("edit")}
                  </button>
                  <DeleteButton id={d.id} locale={locale} />
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function DocForm({
  doc,
  locale,
  onDone,
  onCancel,
}: {
  doc?: CompanyDoc;
  locale: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("administration");
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (prev: DocumentState, fd: FormData) => {
      const res = await saveCompanyDocumentAction(prev, fd);
      if (res.ok) {
        onDone();
        router.refresh();
      }
      return res;
    },
    initial,
  );

  return (
    <form
      action={action}
      className="mb-3 space-y-3 rounded-2xl border border-brand/40 bg-card p-4"
    >
      {doc ? <input type="hidden" name="id" value={doc.id} /> : null}
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="title">{t("fields.title")}</Label>
          <Input
            id="title"
            name="title"
            required
            maxLength={200}
            defaultValue={doc?.title ?? ""}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="category">{t("fields.category")}</Label>
          <select
            id="category"
            name="category"
            defaultValue={doc?.category ?? "other"}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`category.${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="document_url">{t("fields.url")}</Label>
          <Input
            id="document_url"
            name="document_url"
            type="url"
            inputMode="url"
            maxLength={2000}
            defaultValue={doc?.document_url ?? ""}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="valid_until">{t("fields.validUntil")}</Label>
          <Input
            id="valid_until"
            name="valid_until"
            type="date"
            defaultValue={doc?.valid_until ?? ""}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">{t("fields.notes")}</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          maxLength={2000}
          defaultValue={doc?.notes ?? ""}
          className="mt-1"
        />
      </div>

      {!state.ok && state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`refusal.${state.error}`)}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" variant="brand" disabled={pending}>
          {t("save")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

/**
 * Two clicks, not `window.confirm` — the repo's own pattern. The second click
 * is the confirmation, and it says what it will do.
 */
function DeleteButton({ id, locale }: { id: string; locale: string }) {
  const t = useTranslations("administration");
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [, action, pending] = useActionState(
    async (prev: DocumentState, fd: FormData) => {
      const res = await deleteCompanyDocumentAction(prev, fd);
      if (res.ok) router.refresh();
      return res;
    },
    initial,
  );

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-destructive hover:underline"
      >
        {t("delete")}
      </button>
    );
  }

  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        disabled={pending}
        className="font-medium text-destructive hover:underline"
      >
        {t("confirmDelete")}
      </button>
    </form>
  );
}
