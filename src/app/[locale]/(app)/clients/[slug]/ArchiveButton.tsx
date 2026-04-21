"use client";

import { useState, useTransition } from "react";
import { archiveClientAction } from "../actions";

export function ArchiveButton({
  clientId,
  locale,
  label,
  confirmLabel,
  disabled,
}: {
  clientId: string;
  locale: string;
  label: string;
  confirmLabel: string;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  function onClick() {
    if (disabled) return;
    if (!awaitingConfirm) {
      setAwaitingConfirm(true);
      return;
    }
    const formData = new FormData();
    formData.set("id", clientId);
    formData.set("locale", locale);
    startTransition(() => archiveClientAction(formData));
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isPending}
      onBlur={() => setAwaitingConfirm(false)}
      className="inline-flex h-10 items-center rounded-md border border-destructive/40 bg-background px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
    >
      {awaitingConfirm ? confirmLabel : label}
    </button>
  );
}
