"use client";

import { useState, useTransition } from "react";

import type { Result } from "../actions";

/**
 * Two clicks, not a `window.confirm`. This is the pattern the rest of the repo
 * already uses (DeleteTaskButton, DeleteContractButton, ArchiveButton): the
 * first click arms the button, blurring disarms it, and the label says what the
 * second click will do. A native confirm dialog steals focus, cannot be styled,
 * and reads differently in every browser.
 */
export function ConfirmDeleteButton({
  id,
  locale,
  label,
  confirmLabel,
  action,
}: {
  id: string;
  locale: string;
  label: string;
  confirmLabel: string;
  action: (formData: FormData) => Promise<Result>;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!armed) {
      setArmed(true);
      return;
    }
    const fd = new FormData();
    fd.set("id", id);
    fd.set("locale", locale);
    startTransition(async () => {
      await action(fd);
      setArmed(false);

    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onBlur={() => setArmed(false)}
      disabled={pending}
      className="rounded-sm text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
