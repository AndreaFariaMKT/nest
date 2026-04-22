"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { updateDraftAction, type DraftEditState } from "../../../actions";

export type InitialDraft = {
  id: string;
  title: string;
  pillar: string | null;
  hook: string | null;
  caption: string | null;
  hashtags: string[];
  status: string;
  transcriptId: string | null;
};

export type InitialSlide = {
  headline: string | null;
  body: string | null;
};

const STATUSES = [
  "draft",
  "text_review",
  "creative_review",
  "client_review",
  "approved",
  "scheduled",
  "published",
  "archived",
] as const;

export function DraftEditForm({
  locale,
  draft,
  initialSlides,
}: {
  locale: string;
  draft: InitialDraft;
  initialSlides: InitialSlide[];
}) {
  const t = useTranslations("contentEngine");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState<
    DraftEditState,
    FormData
  >(updateDraftAction, {});

  const [slides, setSlides] = useState<InitialSlide[]>(() =>
    initialSlides.length > 0 ? initialSlides : [{ headline: "", body: "" }],
  );

  const slidesJson = useMemo(() => JSON.stringify(slides), [slides]);

  function update(index: number, patch: Partial<InitialSlide>) {
    setSlides((current) =>
      current.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  function move(index: number, delta: number) {
    setSlides((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function add() {
    setSlides((current) => [...current, { headline: "", body: "" }]);
  }

  function remove(index: number) {
    setSlides((current) =>
      current.length <= 1 ? current : current.filter((_, i) => i !== index),
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="draftId" value={draft.id} />
      <input type="hidden" name="slides" value={slidesJson} />

      <div className="space-y-1.5">
        <Label htmlFor="title">{t("draftFields.title")}</Label>
        <Input
          id="title"
          name="title"
          required
          minLength={2}
          maxLength={200}
          defaultValue={draft.title}
        />
        {state.fieldErrors?.title ? (
          <p className="text-xs text-destructive">
            {t(`errors.${state.fieldErrors.title}`)}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pillar">{t("draftFields.pillar")}</Label>
          <Input
            id="pillar"
            name="pillar"
            maxLength={120}
            defaultValue={draft.pillar ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">{t("draftFields.status")}</Label>
          <select
            id="status"
            name="status"
            defaultValue={draft.status}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`draftStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hook">{t("draftFields.hook")}</Label>
        <Input
          id="hook"
          name="hook"
          maxLength={200}
          defaultValue={draft.hook ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="caption">{t("draftFields.caption")}</Label>
        <Textarea
          id="caption"
          name="caption"
          rows={5}
          maxLength={2200}
          defaultValue={draft.caption ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hashtags">{t("draftFields.hashtags")}</Label>
        <Textarea
          id="hashtags"
          name="hashtags"
          rows={2}
          maxLength={800}
          defaultValue={draft.hashtags.join(", ")}
          placeholder="#investir, #financas"
        />
        <p className="text-xs text-muted-foreground">
          {t("draftFields.hashtagsHint")}
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">{t("draftFields.slides")}</h2>
          <button
            type="button"
            onClick={add}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            + {t("draftActions.addSlide")}
          </button>
        </div>
        <ol className="space-y-2">
          {slides.map((slide, index) => (
            <li
              key={index}
              className="rounded-md border border-border bg-card p-3"
              data-testid="draft-slide"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("draftFields.slideN", { n: index + 1 })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={t("draftActions.moveUp")}
                    className="h-7 rounded px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === slides.length - 1}
                    aria-label={t("draftActions.moveDown")}
                    className="h-7 rounded px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={slides.length <= 1}
                    aria-label={t("draftActions.removeSlide")}
                    className="h-7 rounded px-2 text-xs text-muted-foreground hover:text-destructive disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Input
                  value={slide.headline ?? ""}
                  onChange={(event) =>
                    update(index, { headline: event.target.value })
                  }
                  placeholder={t("draftFields.slideHeadline")}
                  maxLength={120}
                  className="h-9"
                />
                <Textarea
                  value={slide.body ?? ""}
                  onChange={(event) =>
                    update(index, { body: event.target.value })
                  }
                  placeholder={t("draftFields.slideBody")}
                  rows={3}
                  maxLength={500}
                />
              </div>
            </li>
          ))}
        </ol>
      </section>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-6">
        <Link
          href={
            draft.transcriptId
              ? `/content-engine/transcripts/${draft.transcriptId}`
              : "/content-engine"
          }
          className="inline-flex h-10 items-center rounded-md px-4 text-sm text-muted-foreground hover:text-foreground"
        >
          {tCommon("cancel")}
        </Link>
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("loading") : t("draftActions.save")}
        </Button>
      </div>
    </form>
  );
}
