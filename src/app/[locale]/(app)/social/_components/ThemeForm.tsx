"use client";


import { useTranslations } from "next-intl";


import { CONTENT_ORIGINS, SOCIAL_CHANNELS } from "@/lib/social";
import { POST_TYPES } from "@/types/database";
import { createThemeAction, type Result } from "../actions";
import { DisclosureForm } from "./DisclosureForm";
import { FieldLabel } from "./Shared";

const field =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * Adding a theme to the shelf. A theme joins the backlog with no date — it only
 * gets one when it is pulled into a fortnight, which is what keeps the shelf a
 * shelf rather than a second calendar.
 */
export function ThemeForm({
  locale,
  clients,
  defaultClient,
}: {
  locale: string;
  clients: { id: string; name: string }[];
  defaultClient?: string;
}) {
  const t = useTranslations("social.themeForm");
  return (
    <DisclosureForm
      action={createThemeAction}
      openLabel={t("open")}
      submitLabel={t("submit")}
    >
      <input type="hidden" name="locale" value={locale} />

        <div>
          <FieldLabel htmlFor="theme-title">
  {t("titleLabel")}
  </FieldLabel>
          <input
            id="theme-title"
            name="title"
            className={field}
            placeholder={t("titlePlaceholder")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="theme-client">
  {t("client")}
  </FieldLabel>
            <select
              id="theme-client"
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
            <FieldLabel htmlFor="theme-pillar">
  {t("axis")}
  </FieldLabel>
            <input
              id="theme-pillar"
              name="pillar"
              className={field}
              placeholder={t("axisPlaceholder")}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor="theme-type">
  {t("format")}
  </FieldLabel>
            <select id="theme-type" name="post_type" className={field}>
              <option value="">—</option>
              {POST_TYPES.map((p) => (
                <option key={p} value={p}>
                  {t(`postType.${p}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="theme-slides">
  {t("slides")}
  </FieldLabel>
            <input
              id="theme-slides"
              name="slide_count"
              type="number"
              min={1}
              max={20}
              className={field}
            />
          </div>
          <div>
            <FieldLabel htmlFor="theme-origin">
  {t("origin")}
  </FieldLabel>
            <select id="theme-origin" name="origin" className={field}>
              <option value="">—</option>
              {CONTENT_ORIGINS.map((o) => (
                <option key={o} value={o}>
                  {t(`originValue.${o}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{t("channels")}</legend>
          <div className="flex flex-wrap gap-4">
            {SOCIAL_CHANNELS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="channels"
                  value={c}
                  defaultChecked={c === "instagram"}
                  className="h-4 w-4 rounded border-input"
                />
                {t(`channel.${c}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <FieldLabel htmlFor="theme-why">
  {t("whyNow")}
  </FieldLabel>
          <textarea
            id="theme-why"
            name="why_now"
            className={`${field} min-h-[80px]`}
            placeholder={t("whyNowPlaceholder")}
          />
          <p className="mt-1 text-xs text-muted-foreground">{t("whyNowHint")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="theme-window">
  {t("window")}
  </FieldLabel>
            <input
              id="theme-window"
              name="window_note"
              className={field}
              placeholder={t("windowPlaceholder")}
            />
          </div>
          <div>
            <FieldLabel htmlFor="theme-source">
  {t("source")}
  </FieldLabel>
            <input
              id="theme-source"
              name="source_ref"
              className={field}
              placeholder={t("sourcePlaceholder")}
            />
          </div>
        </div>

    </DisclosureForm>
  );
}
