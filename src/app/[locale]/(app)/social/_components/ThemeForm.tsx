"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";

import { CONTENT_ORIGINS, SOCIAL_CHANNELS } from "@/lib/social";
import { POST_TYPES } from "@/types/database";
import { createThemeAction, type Result } from "../actions";
import { Refusal } from "./PieceActions";

const initial: Result = { ok: false };

const field =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const labelCls =
  "mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground";

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
  const [state, action, pending] = useActionState(createThemeAction, initial);
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
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

      <form ref={ref} action={action} className="space-y-4 p-5">
        <input type="hidden" name="locale" value={locale} />

        <div>
          <label className={labelCls} htmlFor="theme-title">
            {t("titleLabel")}
          </label>
          <input
            id="theme-title"
            name="title"
            className={field}
            placeholder={t("titlePlaceholder")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="theme-client">
              {t("client")}
            </label>
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
            <label className={labelCls} htmlFor="theme-pillar">
              {t("axis")}
            </label>
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
            <label className={labelCls} htmlFor="theme-type">
              {t("format")}
            </label>
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
            <label className={labelCls} htmlFor="theme-slides">
              {t("slides")}
            </label>
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
            <label className={labelCls} htmlFor="theme-origin">
              {t("origin")}
            </label>
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
          <legend className={labelCls}>{t("channels")}</legend>
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
          <label className={labelCls} htmlFor="theme-why">
            {t("whyNow")}
          </label>
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
            <label className={labelCls} htmlFor="theme-window">
              {t("window")}
            </label>
            <input
              id="theme-window"
              name="window_note"
              className={field}
              placeholder={t("windowPlaceholder")}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="theme-source">
              {t("source")}
            </label>
            <input
              id="theme-source"
              name="source_ref"
              className={field}
              placeholder={t("sourcePlaceholder")}
            />
          </div>
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
