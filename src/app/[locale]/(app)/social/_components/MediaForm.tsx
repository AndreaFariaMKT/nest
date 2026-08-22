"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";

import { deleteMediaAction, saveMediaAction, type Result } from "../actions";
import { Refusal } from "./PieceActions";

const initial: Result = { ok: false };

const field =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const labelCls =
  "mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground";

export function MediaForm({
  locale,
  clients,
  defaultClient,
  today,
}: {
  locale: string;
  clients: { id: string; name: string }[];
  defaultClient?: string;
  today: string;
}) {
  const t = useTranslations("social.mediaForm");
  const [state, action, pending] = useActionState(saveMediaAction, initial);
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (state.ok) {
      form.current?.reset();
      if (details.current) details.current.open = false;
      router.refresh();
    }
  }, [state, router]);

  return (
    <details
      ref={details}
      className="mb-4 rounded-2xl border border-border bg-card [&[open]>summary]:border-b"
    >
      <summary className="cursor-pointer list-none border-border px-5 py-3.5 text-sm font-medium text-brand">
        + {t("open")}
      </summary>

      <form ref={form} action={action} className="space-y-4 p-5">
        <input type="hidden" name="locale" value={locale} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="media-client">
              {t("client")}
            </label>
            <select
              id="media-client"
              name="client_id"
              defaultValue={defaultClient}
              className={field}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="media-title">
              {t("titleLabel")}
            </label>
            <input
              id="media-title"
              name="title"
              className={field}
              placeholder={t("titlePlaceholder")}
            />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="media-url">
            {t("link")}
          </label>
          <input
            id="media-url"
            name="url"
            className={field}
            placeholder="https://…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="media-access">
              {t("access")}
            </label>
            <input
              id="media-access"
              name="access_note"
              className={field}
              placeholder={t("accessPlaceholder")}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="media-date">
              {t("capturedOn")}
            </label>
            <input
              id="media-date"
              name="captured_on"
              type="date"
              defaultValue={today}
              className={field}
            />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="media-desc">
            {t("description")}
          </label>
          <textarea
            id="media-desc"
            name="description"
            className={`${field} min-h-[72px]`}
            placeholder={t("descriptionPlaceholder")}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="brand" disabled={pending}>
            {t("submit")}
          </Button>
          <Refusal error={state.error} />
        </div>
      </form>
    </details>
  );
}

/** Removing raw material is rare and irreversible, so it confirms first. */
export function DeleteMediaButton({
  id,
  locale,
  label,
  confirmLabel,
}: {
  id: string;
  locale: string;
  label: string;
  confirmLabel: string;
}) {
  const router = useRouter();
  return (
    <form
      action={async (fd: FormData) => {
        await deleteMediaAction(fd);
        router.refresh();
      }}
      onSubmit={(e) => {
        if (!window.confirm(confirmLabel)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        className="rounded-sm text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
      </button>
    </form>
  );
}
