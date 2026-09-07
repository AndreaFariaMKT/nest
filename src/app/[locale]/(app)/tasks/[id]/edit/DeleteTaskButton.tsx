"use client";

import { useState, useTransition } from "react";
import { deleteTaskAction } from "../../actions";

export function DeleteTaskButton({
  taskId,
  locale,
  label,
  confirmLabel,
}: {
  taskId: string;
  locale: string;
  label: string;
  confirmLabel: string;
}) {
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (!awaitingConfirm) {
      setAwaitingConfirm(true);
      return;
    }
    const fd = new FormData();
    fd.set("id", taskId);
    fd.set("locale", locale);
    startTransition(() => deleteTaskAction(fd));
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      onBlur={() => setAwaitingConfirm(false)}
      className="inline-flex h-10 items-center rounded-md border border-destructive/40 bg-background px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
    >
      {awaitingConfirm ? confirmLabel : label}
    </button>
  );
}
