"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { isReschedulable } from "@/lib/scheduling";
import { reschedulePostAction, type RescheduleState } from "./actions";

const initial: RescheduleState = { ok: false };

/**
 * The date cell, which opens into a slot picker.
 *
 * A date field rather than a drag: this screen is a table, and there is no
 * spatial axis to drag along — the row order is the schedule, not a grid of
 * days. Typing "the 4th at 09:00" is also the thing people actually mean,
 * which dragging a row can only approximate.
 *
 * The control is only rendered for a post that can still move; the rest show
 * the date as text, so nothing offers an edit the server would refuse.
 */
export function RescheduleCell({
  id,
  status,
  label,
  value,
  locale,
}: {
  id: string;
  status: string;
  /** Already formatted in the studio's timezone by the server. */
  label: string;
  /** `datetime-local` shape, studio clock. */
  value: string;
  locale: string;
}) {
  const t = useTranslations("scheduling.move");
  const [state, action, pending] = useActionState(reschedulePostAction, initial);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (!isReschedulable(status)) {
    return <span className="whitespace-nowrap">{label}</span>;
  }

  if (!open) {
    return (
      <span className="flex items-center gap-2 whitespace-nowrap">
        {label}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t("reschedule")}
        </button>
      </span>
    );
  }

  return (
    <form
      action={(fd) => {
        action(fd);
        router.refresh();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
      <input
        type="datetime-local"
        name="scheduled_for"
        defaultValue={value}
        required
        aria-label={t("reschedule")}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <Button type="submit" disabled={pending} className="h-8 px-2 text-xs">
        {t("save")}
      </Button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-muted-foreground hover:underline"
      >
        {t("cancel")}
      </button>
      {!state.ok && state.error ? (
        <p role="alert" className="w-full text-xs text-destructive">
          {t(`refusal.${state.error}`)}
        </p>
      ) : null}
    </form>
  );
}
