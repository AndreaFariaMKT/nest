"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { attachArtworkAction, removeArtworkAction } from "../actions";
import { Refusal, useRefreshingAction } from "./ActionPrimitives";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";

export interface ArtworkImage {
  id: string;
  position: number;
  url: string;
}

/**
 * The final images, in the order they will publish.
 *
 * Deliberately NOT a replacement for the folder link. That link is where the
 * work lives — versions, open files, the way the designer organises it. This
 * is the export: the finished images, somewhere Instagram's API can fetch
 * them, because it builds a post from URLs it can open and a Drive folder is
 * not one of those.
 *
 * Attaching is optional. A piece with artwork can enter the real publishing
 * queue; a piece without behaves exactly as it always has — someone posts it
 * by hand and marks it live. The panel says which, because the worst outcome
 * here is somebody believing a post is scheduled when nothing will send it.
 */
export function ArtworkPanel({
  pieceId,
  locale,
  images,
  canEdit,
}: {
  pieceId: string;
  locale: string;
  images: ArtworkImage[];
  canEdit: boolean;
}) {
  const t = useTranslations("social.artwork");
  const { state, dispatch, pending } = useRefreshingAction(attachArtworkAction);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg">{t("title")}</h2>
        <span
          className={
            images.length
              ? "text-xs font-medium text-brand"
              : "text-xs text-muted-foreground"
          }
        >
          {images.length ? t("willPublish") : t("willBeManual")}
        </span>
      </div>

      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {images.length ? t("hasArtworkNote") : t("noArtworkNote")}
      </p>

      {/* Stated because the interface would otherwise imply a precision the
          schedule does not have. The publish cron runs once a day — the Hobby
          plan's ceiling — so `publish_time` is honoured to within that window,
          not to the minute. Promising "08:00" and delivering the next morning
          is worse than saying so here. */}
      {images.length ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("dailyWindow")}</p>
      ) : null}

      {images.length ? (
        <ol className="mt-4 flex flex-wrap gap-3">
          {images.map((img) => (
            <li key={img.id} className="w-24">
              {/* Plain <img>: these are arbitrary user exports at unknown
                  dimensions, and next/image would want a loader config per
                  bucket for no benefit at thumbnail size. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={t("slideAlt", { n: img.position })}
                className="aspect-[4/5] w-full rounded-md border border-border object-cover"
              />
              <span className="mt-1 block text-center text-[10px] text-muted-foreground">
                {img.position}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {canEdit ? (
        <form action={dispatch} className="mt-4 space-y-3">
          <input type="hidden" name="id" value={pieceId} />
          <input type="hidden" name="locale" value={locale} />
          <div>
            <input
              type="file"
              name="artwork"
              multiple
              accept="image/png,image/jpeg"
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70"
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("pickHint")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="brand" disabled={pending}>
              {images.length ? t("replace") : t("attach")}
            </Button>
            {images.length ? (
              <ConfirmDeleteButton
                action={removeArtworkAction}
                id={pieceId}
                locale={locale}
                label={t("remove")}
                confirmLabel={t("removeConfirm")}
              />
            ) : null}
            <Refusal error={state.error} />
          </div>
        </form>
      ) : null}
    </section>
  );
}
