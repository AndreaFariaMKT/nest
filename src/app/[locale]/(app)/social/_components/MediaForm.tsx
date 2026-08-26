"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { saveMediaAction } from "../actions";
import { DisclosureForm } from "./DisclosureForm";
import { FieldLabel } from "./Shared";
import type { MediaRow } from "./MediaList";

const field =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * One form for adding a media item and for correcting one.
 *
 * `saveMediaAction` has always handled both — it reads an `id` and branches to
 * an update — but nothing ever sent one. So a typo in a title, a wrong URL or
 * a stale access note could only be fixed by deleting the row and retyping all
 * six fields, and the client's own /portal/media screen kept showing whatever
 * was typed the first time.
 *
 * Field ids come from useId() because the edit variant renders once per row on
 * a page that maps over many; a static id would bind every label to the first
 * card's input.
 */
export function MediaForm({
  locale,
  clients,
  defaultClient,
  today,
  initial,
}: {
  locale: string;
  clients: { id: string; name: string }[];
  defaultClient?: string;
  today: string;
  /** Present when correcting an existing item. */
  initial?: MediaRow;
}) {
  const t = useTranslations("social.mediaForm");
  const uid = useId();
  const editing = Boolean(initial);

  return (
    <DisclosureForm
      action={saveMediaAction}
      openLabel={editing ? t("edit") : t("open")}
      submitLabel={editing ? t("save") : t("submit")}
    >
      <input type="hidden" name="locale" value={locale} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${uid}-client`}>{t("client")}</FieldLabel>
          <select
            id={`${uid}-client`}
            name="client_id"
            defaultValue={initial?.client_id ?? defaultClient}
            // The client is set once, on creation — the action ignores it on an
            // edit, and moving material between clients is not a correction.
            disabled={editing}
            className={`${field} disabled:opacity-60`}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor={`${uid}-title`}>{t("titleLabel")}</FieldLabel>
          <input
            id={`${uid}-title`}
            name="title"
            defaultValue={initial?.title ?? ""}
            className={field}
            placeholder={t("titlePlaceholder")}
          />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor={`${uid}-url`}>{t("link")}</FieldLabel>
        <input
          id={`${uid}-url`}
          name="url"
          defaultValue={initial?.url ?? ""}
          className={field}
          placeholder="https://…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${uid}-access`}>{t("access")}</FieldLabel>
          <input
            id={`${uid}-access`}
            name="access_note"
            defaultValue={initial?.access_note ?? ""}
            className={field}
            placeholder={t("accessPlaceholder")}
          />
        </div>
        <div>
          <FieldLabel htmlFor={`${uid}-date`}>{t("capturedOn")}</FieldLabel>
          <input
            id={`${uid}-date`}
            name="captured_on"
            type="date"
            defaultValue={initial?.captured_on ?? today}
            className={field}
          />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor={`${uid}-desc`}>{t("description")}</FieldLabel>
        <textarea
          id={`${uid}-desc`}
          name="description"
          defaultValue={initial?.description ?? ""}
          className={`${field} min-h-[72px]`}
          placeholder={t("descriptionPlaceholder")}
        />
      </div>
    </DisclosureForm>
  );
}
