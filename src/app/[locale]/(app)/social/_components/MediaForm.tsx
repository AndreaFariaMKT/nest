"use client";


import { useTranslations } from "next-intl";


import { saveMediaAction, type Result } from "../actions";
import { DisclosureForm } from "./DisclosureForm";
import { FieldLabel } from "./Shared";

const field =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

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
  return (
    <DisclosureForm
      action={saveMediaAction}
      openLabel={t("open")}
      submitLabel={t("submit")}
    >
      <input type="hidden" name="locale" value={locale} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="media-client">
  {t("client")}
  </FieldLabel>
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
            <FieldLabel htmlFor="media-title">
  {t("titleLabel")}
  </FieldLabel>
            <input
              id="media-title"
              name="title"
              className={field}
              placeholder={t("titlePlaceholder")}
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="media-url">
  {t("link")}
  </FieldLabel>
          <input
            id="media-url"
            name="url"
            className={field}
            placeholder="https://…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="media-access">
  {t("access")}
  </FieldLabel>
            <input
              id="media-access"
              name="access_note"
              className={field}
              placeholder={t("accessPlaceholder")}
            />
          </div>
          <div>
            <FieldLabel htmlFor="media-date">
  {t("capturedOn")}
  </FieldLabel>
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
          <FieldLabel htmlFor="media-desc">
  {t("description")}
  </FieldLabel>
          <textarea
            id="media-desc"
            name="description"
            className={`${field} min-h-[72px]`}
            placeholder={t("descriptionPlaceholder")}
          />
        </div>

    </DisclosureForm>
  );
}

/** Removing raw material is rare and irreversible, so it confirms first. */
