import { useTranslations } from "next-intl";

import { Pill } from "@/components/ui/Pill";
import { EmptyState, useDateLabel } from "./Shared";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { deleteMediaAction } from "../actions";

export interface MediaRow {
  id: string;
  client_id: string;
  title: string;
  url: string;
  access_note: string | null;
  description: string | null;
  captured_on: string;
}

/**
 * Raw material — footage, stills, recordings. Finished pieces live on the
 * record, not here.
 */
export function MediaList({
  items,
  clientName,
  locale,
  canEdit,
  showClient = true,
  emptyKey,
}: {
  items: MediaRow[];
  clientName: (id: string) => string;
  locale: string;
  canEdit: boolean;
  showClient?: boolean;
  /**
   * Which empty message to show. The default says "nothing for this filter" —
   * true on the studio screen, which has a client picker, and false in the
   * portal, which has none: a client was being pointed at a control that is
   * not on their screen.
   */
  emptyKey?: string;
}) {
  const t = useTranslations("social.media");
  const date = useDateLabel();

  if (!items.length) {
    return (
      <EmptyState>
        {emptyKey ? t(emptyKey) : t("empty")}
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((m) => (
        <article
          key={m.id}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <header className="mb-2 flex flex-wrap items-start gap-2">
            {showClient ? (
              <Pill tone="muted" className="text-[10px]">
                {clientName(m.client_id)}
              </Pill>
            ) : null}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium leading-snug text-foreground">
                {m.title}
              </h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t("shot", { date: date(m.captured_on) ?? m.captured_on })}
              </p>
            </div>
            <Pill tone={m.access_note ? "warning" : "muted"} className="text-[10px]">
              {m.access_note ? t("accessNeeded") : t("openLink")}
            </Pill>
          </header>

          <a
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block break-all text-xs text-brand hover:underline"
          >
            {m.url}
          </a>

          {m.access_note ? (
            <p className="mt-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              {m.access_note}
            </p>
          ) : null}

          {m.description ? (
            <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
              {m.description}
            </p>
          ) : null}

          {canEdit ? (
            <div className="mt-3 flex justify-end">
              <ConfirmDeleteButton
                id={m.id}
                locale={locale}
                label={t("delete")}
                confirmLabel={t("deleteConfirm")}
                action={deleteMediaAction}
              />
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
