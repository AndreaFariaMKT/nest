"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/routing";

import {
  BOARD_BUCKETS,
  bucketOf,
  canMoveToBucket,
  dropTargets,
  type BucketKey,
} from "@/lib/content-board";
import { moveDraftToBucketAction } from "./actions";

export type BoardDraft = {
  id: string;
  title: string;
  pillar: string | null;
  status: string;
  client_id: string;
};

/**
 * The content calendar, with cards that move.
 *
 * Drag is an enhancement, not the mechanism. Every card also carries a plain
 * `<select>` of the columns it may go to, submitting the same server action —
 * so the board works with a keyboard, with a screen reader, and on a phone,
 * where dragging a card between four columns is not a real gesture. A board
 * that can only be operated by dragging is a board half the studio cannot use.
 *
 * Drop zones come from `dropTargets`, so a column that would refuse a card
 * never lights up for it, and the refusal below is for the cases only the
 * server can know about.
 */
export function Board({
  drafts,
  clientNames,
  locale,
}: {
  drafts: BoardDraft[];
  clientNames: Record<string, string>;
  locale: string;
}) {
  const t = useTranslations("contentCalendar");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState<BoardDraft | null>(null);
  const [over, setOver] = useState<BucketKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  function move(id: string, bucket: string) {
    setError(null);
    const data = new FormData();
    data.set("id", id);
    data.set("bucket", bucket);
    data.set("locale", locale);
    startTransition(async () => {
      const res = await moveDraftToBucketAction({ ok: false }, data);
      if (!res.ok && res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {t(`board.refusal.${error}`)}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {BOARD_BUCKETS.map((bucket) => {
          const items = drafts.filter((d) => bucketOf(d.status) === bucket.key);
          const accepts =
            !!dragging && canMoveToBucket(dragging.status, bucket.key).ok;

          return (
            <section
              key={bucket.key}
              onDragOver={(e) => {
                if (!accepts) return;
                e.preventDefault();
                setOver(bucket.key);
              }}
              onDragLeave={() => setOver((o) => (o === bucket.key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                if (dragging && accepts) move(dragging.id, bucket.key);
                setDragging(null);
              }}
              className={[
                "rounded-2xl border p-4 transition-colors",
                accepts && over === bucket.key
                  ? "border-brand bg-brand-soft/40"
                  : accepts
                    ? "border-brand/40 bg-card"
                    : "border-border bg-card",
              ].join(" ")}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(`buckets.${bucket.key}`)}
                </h2>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </div>

              <ul className="space-y-2">
                {items.map((d) => {
                  const targets = dropTargets(d.status);
                  return (
                    <li
                      key={d.id}
                      draggable={targets.length > 0}
                      onDragStart={() => setDragging(d)}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      className={[
                        "rounded-xl border border-border bg-background/60 p-3",
                        targets.length ? "cursor-grab active:cursor-grabbing" : "",
                        pending ? "opacity-60" : "",
                      ].join(" ")}
                    >
                      <Link
                        href={`/content-engine/drafts/${d.id}/edit`}
                        className="block truncate text-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        {d.title}
                      </Link>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {clientNames[d.client_id] ?? "—"}
                        {d.pillar ? ` · ${d.pillar}` : ""}
                      </span>

                      {targets.length ? (
                        <label className="mt-2 block">
                          <span className="sr-only">{t("board.moveTo")}</span>
                          <select
                            value=""
                            disabled={pending}
                            onChange={(e) => {
                              if (e.target.value) move(d.id, e.target.value);
                            }}
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">
                              {pending ? t("board.moving") : t("board.moveTo")}
                            </option>
                            {targets.map((k) => (
                              <option key={k} value={k}>
                                {t(`buckets.${k}`)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </li>
                  );
                })}

                {items.length === 0 ? (
                  <li className="py-2 text-center text-xs text-muted-foreground">
                    {accepts ? t("board.dropHere") : "—"}
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
